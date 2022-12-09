import { Logger, PlatformConfig } from 'homebridge';
import { TeslafiAPI } from './api';
import { ITeslaCar } from './ITesla';
import { EventEmitter } from 'events';
import * as fs from 'fs';

export class TeslaCar implements ITeslaCar {
  public em: EventEmitter;
  private intervallRefresh: any;
  private hasReadCachedData = false;
  public skipUpdate = false; // If an API call is ongoing, ignoree event in order to not reset accessory status.

  public rangeUnit: string;
  private milesToKm = 1.609344;
  public tempUnit: string;
  private teslafiapi: TeslafiAPI;

  private teslafiRefreshTimeout: number;
  private wakeupTimeout: number;

  public display_name = 'Tesla';
  public isOnline = false;
  public notes = '';
  public carState = '';
  public sentry_mode = false;

  public software = {
    current: '2003.7.1', // Default value until we have the actual. This is Tesla founding date ;)
    new: '2003.7.1',
    status: '',
  };

  // Current location
  public location = '';

  public chargePortOpen = false;

  public doorLockOpen = false;

  public battery = {
    charging: false,
    connected: false,
    level: 50,
    usableLevel: 50,
    heater: false,
    range: 0,
    estimatedRange: 0,
    chargeLimit: 90,
    chargingCurrentRate: 0, // "charge_rate" range
    chargingPhases: 0, // "charger_phases"
    chargingAmpere: 0, // "charger_actual_current"
    chargingVoltage: 0, //"charger_voltage": "233"
    chargingAddedRange: 0, // "charge_miles_added_rated"
    chargingAddedEnergy: 0, // "charge_energy_added"
    chargingTimeToFull: '', //"time_to_full_charge"
    chargingState: '', // "charging_state"
  };
  /**
   "time_to_full_charge": "7.58",
   "charge_current_request": "16",
   "charge_enable_request": "1",
   "charge_to_max_range": "0",
   "charger_phases": "1",
   "charger_power": "4",
   "charge_limit_soc": "90",
   "charger_pilot_current": "16",
   "charge_port_latch": "Engaged",
   "charger_actual_current": "16",
   "charge_limit_soc_std": "90",
   "charge_energy_added": "15.28",
   "charge_port_door_open": "1",
   "charge_limit_soc_max": "100",
   "charge_rate": "14.1",
   "charger_voltage": "233",
   "charge_current_request_max": "16",
   "charge_miles_added_ideal": "62.5",
   "charge_limit_soc_min": "50",
   "charge_miles_added_rated": "62.5",
 */
  public climateControl = {
    canHeat: true, // not_enough_power_to_heat
    isClimateOn: false, // is_auto_conditioning_on
    insideTemp: 20, // inside_temp
    outsideTemp: 20, // outside_temp
    maxAvailTemp: 28, // max_avail_temp
    minAvailTemp: 15, // min_avail_temp
    tempSetting: 20, // driver_temp_setting  - also passenger_temp_setting, use?
  };

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly storagePath: string
  ) {
    this.em = new EventEmitter();

    this.rangeUnit = <string>config['rangeUnit'];
    this.tempUnit = <string>config['tempUnit'];

    config['teslafiRefreshTimeout'] &&
    !isNaN(<number>config['teslafiRefreshTimeout'])
      ? (this.teslafiRefreshTimeout =
          <number>config['teslafiRefreshTimeout'] * 1000)
      : (this.teslafiRefreshTimeout = 60 * 1000);
    // Make sue we don't refresh more often than every 20 seconds, Teslafi rate limit  
    if(this.teslafiRefreshTimeout < 20000) {
      this.teslafiRefreshTimeout = 20000;
    }

    config['wakeupTimeout'] && !isNaN(<number>config['wakeupTimeout'])
      ? (this.wakeupTimeout = <number>config['wakeupTimeout'])
      : (this.wakeupTimeout = 15);

    this.teslafiapi = new TeslafiAPI(log, config);
    this.refresh();

    this.intervallRefresh = setInterval(() => {
      this.refresh();
    }, this.teslafiRefreshTimeout);
  }

  private writeCache(result: JSON) {
    try {
      fs.writeFileSync(
        this.storagePath + '/' + this.config.name + '_cachedResults.json',
        JSON.stringify(result)
      );
    } catch (err) {
      this.log.warn('Failed to write API logs results cache file.');
    }
  }

  private async fetchData(): Promise<any> {
    if (!this.hasReadCachedData) {
      const cacheFile =
        this.storagePath + '/' + this.config.name + '_cachedResults.json';

      return fs.promises
        .access(cacheFile, fs.constants.F_OK)
        .then(() => {
          return fs.promises
            .readFile(cacheFile)
            .then((storedFile) => {
              this.hasReadCachedData = true;
              this.log.warn(
                'TeslaFi API cached data loaded, non-stale data will be loaded when car is online on next refresh'
              );
              setTimeout(() => {
                this.refresh();
              }, 3000);
              return JSON.parse(storedFile.toString());
            })
            .catch(() => false);
        })
        .catch(() => false)
        .finally(() => {
          if (!this.hasReadCachedData) {
            // We did not find any cache file, mark as if we have tried and fecth what we can
            this.log.warn(
              'TeslaFi API cached data not available, will fetch from TeslaFI API'
            );
          }
          this.hasReadCachedData = true;
        });
    }

    return await this.teslafiapi.action('', '');
  }

  public async refresh() {
    const result = await this.fetchData();

    // Is car online?
    if (result.state && result.state === 'online') {
      this.isOnline = true;
    } else {
      this.isOnline = false;
    }

    // Store Notes to be used in dashlet
    this.notes = this.washString(result.Notes);

    // There was an API fetch error, so ignore the results.
    if (this.notes.indexOf('API') > -1) {
      this.log.info(
        'There was an API fetch issue. This will recover, skipping this update.',
        this.notes
      );
      this.skipUpdate = false;
      return;
    }

    // Car is not really online from a Teslafi perspective if trying to sleep
    if (this.notes && this.notes === 'Trying To Sleep') {
      this.isOnline = false;
    }

    this.carState = this.washString(result.carState);

    if (this.isOnline) {
      // When asleep, teslafi returns null for most values, so keep what we have
      // Also when Trying to sleep, it returns online, but values ar null!

      // Climate is_climate_on (not is_auto_conditioning_on)
      result.is_climate_on && result.is_climate_on === '1'
        ? (this.climateControl.isClimateOn = true)
        : (this.climateControl.isClimateOn = false);

      result.not_enough_power_to_heat
        ? (this.climateControl.canHeat = false)
        : (this.climateControl.canHeat = true); // has a null value if it can heat? To be verified

      if (result.inside_temp) {
        this.climateControl.insideTemp = parseFloat(result.inside_temp);
      }

      if (result.outside_temp) {
        this.climateControl.outsideTemp = parseFloat(result.outside_temp);
      }

      if (result.max_avail_temp) {
        this.climateControl.maxAvailTemp = parseFloat(result.max_avail_temp);
      }

      if (result.min_avail_temp) {
        this.climateControl.minAvailTemp = parseFloat(result.min_avail_temp);
      }

      if (result.driver_temp_setting) {
        this.climateControl.tempSetting = parseFloat(
          result.driver_temp_setting
        );
      }

      // Sentry mode
      if (result.sentry_mode && result.sentry_mode === '1') {
        this.sentry_mode = true;
      } else if (result.sentry_mode && result.sentry_mode === '0') {
        this.sentry_mode = false;
      } else {
        this.log.debug(
          'Sentry mode returned unexpected result.',
          result.sentry_mode
        );
      }

      // Battery & Charge
      if (result.battery_range) {
        let range = parseFloat(result.battery_range);
        if (this.rangeUnit === 'km') {
          range = range * this.milesToKm;
        }
        this.battery.range = Math.round(range);
      }
      if (result.est_battery_range) {
        let range = parseInt(result.est_battery_range);
        if (this.rangeUnit === 'km') {
          range = range * this.milesToKm;
        }
        this.battery.estimatedRange = Math.round(range);
      }
      result.carState && result.carState === 'Charging'
        ? (this.battery.charging = true)
        : (this.battery.charging = false);

      // Charging cable connected, empty string false, connected returns an id of cable (non empty string)
      // There is something wrong with the parsing if empty, becomes <invalid>
      result.conn_charge_cable && result.conn_charge_cable !== '<invalid>'
        ? (this.battery.connected = true)
        : (this.battery.connected = false);

      if (result.battery_level && parseInt(result.battery_level)) {
        this.battery.level = parseInt(result.battery_level);
      }

      if (
        result.usable_battery_level &&
        parseInt(result.usable_battery_level)
      ) {
        this.battery.usableLevel = parseInt(result.usable_battery_level);
      }

      if (result.charge_limit_soc && parseInt(result.charge_limit_soc)) {
        this.battery.chargeLimit = parseInt(result.charge_limit_soc);
      }
      result.battery_heater_on && result.battery_heater_on === '1'
        ? (this.battery.heater = true)
        : (this.battery.heater = false);

      if (result.charge_rate) {
        this.battery.chargingCurrentRate = parseInt(result.charge_rate);
      }

      if (result.charger_phases) {
        this.battery.chargingPhases = parseInt(result.charger_phases);
      }
      if (result.charger_actual_current) {
        this.battery.chargingAmpere = parseInt(result.charger_actual_current);
      }
      if (result.charger_voltage) {
        this.battery.chargingVoltage = parseInt(result.charger_voltage);
      }
      if (result.charge_miles_added_rated) {
        this.battery.chargingAddedRange = parseFloat(
          result.charge_miles_added_rated
        );
        if (this.rangeUnit === 'km') {
          this.battery.chargingAddedRange = Math.round(
            this.battery.chargingAddedRange * this.milesToKm
          );
        } else {
          this.battery.chargingAddedRange = Math.round(
            this.battery.chargingAddedRange
          );
        }
      }
      if (result.charge_energy_added) {
        this.battery.chargingAddedEnergy = parseInt(result.charge_energy_added);
      }
      if (result.time_to_full_charge) {
        // Chargin time left is returned as fraction of minues
        let chargingTime = <string>result.time_to_full_charge.split('.');
        this.battery.chargingTimeToFull =
          chargingTime[0] +
          ':' +
          Math.round((parseInt(chargingTime[1].padEnd(2, '0')) / 100) * 60)
            .toString()
            .padStart(2, '0');
      }
      if (result.charging_state) {
        this.battery.chargingState = result.charging_state;
      }

      result.locked && result.locked !== '1'
        ? (this.doorLockOpen = true)
        : (this.doorLockOpen = false);

      if (result.car_version) {
        let versionArray = this.washString(result.car_version).split(' ');
        this.software.current = versionArray[0] ? versionArray[0] : '-';
      }

      this.software.new = this.washString(result.newVersion);
      // Looks like Tesla/TeslaFi changed their APU, used to always return version, now empty string if not actually new version
      // Returns one space string of "emtpy", so check length
      if (this.software.new.length < 4) {
        this.software.new = '-';
      }
    } else {
      // Since we are offline, this must be the actual state
      this.climateControl.isClimateOn = false;
      this.sentry_mode = false;
      this.battery.charging = false;
      // Issue #4, you can actaully let the car sleep with unlocked doors. Commenting out this assumption
      // this.doorLockOpen = false;
    }

    // These we check outside of being online
    // Use "charge_port_latch":"Disengaged" or "charge_port_latch":"Engaged" instead of charge_port_door_open: "1"
    // What we want is if we can Connect/disconnect cable. So for example if car is charging, show as locked even
    // if charge port is actually open. That way we can "unlock" and release charge cable.
    result.charge_port_latch && result.charge_port_latch === 'Disengaged'
      ? (this.chargePortOpen = true)
      : (this.chargePortOpen = false);

    this.location = this.washString(result.location);

    this.software.status = this.washString(result.newVersionStatus);

    // Finally emit event
    this.em.emit('teslafifetch');
    // If for some reason, the skip has not been reset, we do so to avoid it never updating. But only after we emitted event.
    // TODO: Evaluate if this has desired outcome.
    this.skipUpdate = false;

    // Write to cache if online as a last good know state.
    if (this.isOnline) {
      this.writeCache(result);
    }
  }

  public async wakeUp() {
    this.skipUpdate = true;
    const command = this.notes === 'Trying To Sleep' ? 'wake' : 'wake_up';
    return await this.teslafiapi
      .action(command, '')
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.isOnline = true;
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  public async sleep() {
    this.skipUpdate = true;
    return await this.teslafiapi
      .action('sleep', '')
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.isOnline = false;
          this.notes = 'Trying To Sleep';
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  public async toggleSentryMode(status) {
    this.skipUpdate = true;
    return await this.teslafiapi
      .action('set_sentry_mode', status)
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.sentry_mode = status;
          this.setCarAsOnline();
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  public async setChargeLimit(value) {
    this.skipUpdate = true;
    return await this.teslafiapi
      .action('set_charge_limit', value)
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.battery.chargeLimit = value;
          this.setCarAsOnline();
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  public async toggleCharging(status) {
    this.skipUpdate = true;
    let action = status ? 'charge_start' : 'charge_stop';
    return await this.teslafiapi
      .action(action, '')
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.battery.charging = status;
          this.setCarAsOnline();
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  public async toggleChargePortOpen(status) {
    this.skipUpdate = true;
    let action = status ? 'charge_port_door_open' : 'charge_port_door_close';
    return await this.teslafiapi
      .action(action, '')
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.chargePortOpen = status;
          this.setCarAsOnline();
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  public async toggleDoorLockOpen(status) {
    this.skipUpdate = true;
    let action = status ? 'door_unlock' : 'door_lock';
    return await this.teslafiapi
      .action(action, '')
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.doorLockOpen = status;
          this.setCarAsOnline();
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  public async toggleClimateOn(status) {
    this.skipUpdate = true;
    let action = status ? 'auto_conditioning_start' : 'auto_conditioning_stop';

    return await this.teslafiapi
      .action(action, '')
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.climateControl.isClimateOn = status;
          this.setCarAsOnline();
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  public async setClimateTemp(temp) {
    this.skipUpdate = true;
    return await this.teslafiapi
      .action('set_temps', temp)
      .then(async (response) => {
        if (response.response && response.response.result) {
          this.climateControl.tempSetting = temp;
          this.setCarAsOnline();
          return true;
        } else {
          // Not changing car state, we do not know the actual state, let polling find out.
          return false;
        }
      })
      .finally(() => {
        this.afterAPICall();
      });
  }

  private setCarAsOnline() {
    //Check if configure to wake the car when sending command, if so also set status to online
    // We do this since it can take some timee for TeslaFi API to update its online status.
    if (this.wakeupTimeout > 0) {
      this.isOnline = true;
    }
  }

  private afterAPICall() {
    this.skipUpdate = false;
    // Restart intervall timer
    clearInterval(this.intervallRefresh);
    this.intervallRefresh = setInterval(() => {
      this.refresh();
    }, this.teslafiRefreshTimeout);

    // Fetch one extra time after 75s, hoping TeslaFi has updated its status. All commands seem to be pass-through to Teslaf api.
    // (it does not for some reason stor for example it is online when recieved such a request)
    setTimeout(() => {
      this.refresh();
    }, 75000);

    // Emit event to update any changes, but wait 1s (just a hunch Homekit not happy if a change comes immediately)
    setTimeout(() => {
      this.em.emit('teslafifetch');
    }, 1000);
  }

  private washString(str) {
    return !!str ? str : '';
  }
}
