import { CharacteristicProps, Service } from 'homebridge';
import { TeslaAccessory } from '../utils/ITesla';

export class TeslaBatteryAccessory extends TeslaAccessory {
  protected batteryService?: Service;
  protected chargeLevelService?: Service;

  protected lowBatteryLevel = this.platform.config['lowBatterylevel']
    ? <number>this.platform.config['lowBatterylevel']
    : 20;

  protected currentStateOutletInUse = false;
  protected currentStateBattereyLevel = 100;
  protected currentStateCharging = 0;
  protected currentStateBatteryLevelLow = 0;
  protected currentChargeLevelSetting = 50;
  protected currentChargeLevelSettingAdjusted = 50;
  protected currentChargeLevelSettingInProgress = false;
  protected chargeLevelIncrement = this.platform.config['chargeLevelIncrement']
    ? <number>this.platform.config['chargeLevelIncrement']
    : 5;

  getService(): Service {
    let service =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.handleChargeOnGet.bind(this))
      .on('set', this.handleChargeOnSet.bind(this));

    service
      .getCharacteristic(this.platform.Characteristic.OutletInUse)
      .on('get', this.handleOutletInUseGet.bind(this));

    // Update the name if there is not already a custom name
    let chargeOutletName = service.getCharacteristic(
      this.platform.Characteristic.ConfiguredName
    );

    if (!chargeOutletName.value) {
      chargeOutletName.updateValue('Charger');
    }

    this.chargeLevelService =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    this.chargeLevelService
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .setProps(<CharacteristicProps>{
        minValue: 50,
        minStep: this.platform.config['chargeLevelIncrement']
          ? <number>this.platform.config['chargeLevelIncrement']
          : 5,
      })
      .on('get', this.handleChargeLevelGet.bind(this))
      .on('set', this.handleChargeLevelSet.bind(this));

    this.chargeLevelService
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.handleChargeLevelOnGet.bind(this))
      .on('set', this.handleChargeLevelOnSet.bind(this));

    // Add the battery Service
    this.batteryService =
      this.accessory.getService(this.platform.Service.BatteryService) ||
      this.accessory.addService(this.platform.Service.BatteryService);

    this.batteryService
      .getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .on('get', this.handleBatteryLevelGet.bind(this));

    this.batteryService
      .getCharacteristic(this.platform.Characteristic.ChargingState)
      .on('get', this.handleChargingStateGet.bind(this));

    this.batteryService
      .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .on('get', this.handleStatusLowBatteryGet.bind(this));

    return service;
  }

  getLatestTeslafiData(): void {
    const oldCurrentStateBattereyLevel = this.currentStateBattereyLevel;
    const oldCurrentStateBatteryLevelLow = this.currentStateBatteryLevelLow;
    const oldCurrentStateOutletInUse = this.currentStateOutletInUse;
    const oldCurrentStateCharging = this.currentStateCharging;
    const oldCurrentState = this.currentState;
    const oldCurrentChargeLevelSetting = this.currentChargeLevelSetting;

    this._updateCurrentState();

    if (oldCurrentStateBattereyLevel !== this.currentStateBattereyLevel) {
      this.batteryService?.updateCharacteristic(
        this.platform.Characteristic.BatteryLevel,
        this.currentStateBattereyLevel
      );
      // Also set the charge in the swith name since Homekit is useless to display data that is there!!
      this.service.setCharacteristic(
        this.platform.Characteristic.ConfiguredName,
        this.platform.accessoryPrefix +
          '\uD83D\uDD0B ' +
          this.currentStateBattereyLevel.toString() +
          '%'
      );
    }

    if (oldCurrentStateBatteryLevelLow !== this.currentStateBatteryLevelLow) {
      this.batteryService?.updateCharacteristic(
        this.platform.Characteristic.StatusLowBattery,
        this.currentStateBatteryLevelLow
      );
    }

    if (oldCurrentStateOutletInUse !== this.currentStateOutletInUse) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.OutletInUse,
        this.currentStateOutletInUse
      );
    }

    if (oldCurrentStateCharging !== this.currentStateCharging) {
      this.batteryService?.updateCharacteristic(
        this.platform.Characteristic.ChargingState,
        this.currentStateCharging
      );
    }

    if (oldCurrentState !== this.currentState) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState
      );
    }
    if (oldCurrentChargeLevelSetting !== this.currentChargeLevelSetting) {
      this.chargeLevelService?.updateCharacteristic(
        this.platform.Characteristic.Brightness,
        this.currentChargeLevelSetting
      );
    }
  }

  _updateCurrentState(): void {
    // Status Low Battery
    this.currentStateBatteryLevelLow =
      this.teslacar.battery.level <= <number>this.lowBatteryLevel
        ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

    // Outlet In use
    this.currentStateOutletInUse = this.platform.teslacar.battery.connected;

    // Battery Level
    this.currentStateBattereyLevel = this.platform.teslacar.battery.level;

    // OnOff
    // Charging state
    this.currentStateCharging = this.platform.Characteristic.ChargingState.NOT_CHARGING;
    this.currentState = false; // Not Charging
    if (!this.teslacar.battery.connected) {
      this.currentStateCharging = this.platform.Characteristic.ChargingState.NOT_CHARGEABLE;
      // No need to set currentState here as it is already "false";
    }
    if (this.teslacar.battery.charging) {
      this.currentStateCharging = this.platform.Characteristic.ChargingState.CHARGING;
      this.currentState = true;
    }
    // Rounding to neares increment, stricly not neccessary as Homebridge will rund to nearest increment by itself when shown
    this.currentChargeLevelSetting = this.adjustChargeLevelToIncrement(
      this.teslacar.battery.chargeLimit
    );
  }

  handleOutletInUseGet(callback) {
    this._updateCurrentState();
    callback(null, this.currentStateOutletInUse);
  }

  handleChargeOnGet(callback) {
    this._updateCurrentState();
    callback(null, this.currentState);
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleChargeOnSet(value, callback) {
    // Only try to start if charge cable connected
    if (
      value &&
      this.currentState === false &&
      this.platform.teslacar.battery.connected === true
    ) {
      await this.teslacar.toggleCharging(true);
      this.platform.teslacar.battery.charging = true;
      this.currentState = value;
      callback(null);
    } else if (
      !value &&
      this.currentState === true &&
      this.platform.teslacar.battery.connected === true
    ) {
      await this.teslacar.toggleCharging(false);
      this.platform.teslacar.battery.charging = false;
      this.currentState = value;
      callback(null);
    } else {
      // Ignore since we cannot start charging when disconnected
      this.currentState = value; // Even if we didn't change, this will trigger an updateCharacteristic in intervall check
      callback('Not Connected');
    }
  }

  /**
   * Handle requests to get the current value of the "Battery Level" characteristic
   */
  handleBatteryLevelGet(callback) {
    // set this to a valid value for BatteryLevel
    this._updateCurrentState();
    callback(null, this.currentStateBattereyLevel);
  }

  /**
   * Handle requests to get the current value of the "Charging State" characteristic
   */
  handleChargingStateGet(callback) {
    this._updateCurrentState();
    callback(null, this.currentStateCharging);
  }

  /**
   * Handle requests to get the current value of the "Status Low Battery" characteristic
   */
  handleStatusLowBatteryGet(callback) {
    // set this to a valid value for StatusLowBattery
    this._updateCurrentState();
    callback(null, this.currentStateBatteryLevelLow);
  }

  handleChargeLevelGet(callback) {
    this._updateCurrentState();
    callback(null, this.currentChargeLevelSetting);
  }

  async handleChargeLevelSet(value, callback) {
    this.currentChargeLevelSettingAdjusted = this.adjustChargeLevelToIncrement(
      value
    );
    // Set this on the car object, else the Get migth have it hop around due to the "delay".
    this.platform.teslacar.battery.chargeLimit = this.currentChargeLevelSettingAdjusted;

    // We need to handle the fact that this gets called for every state the slider passes. Only update for the "final" value.
    if (!this.currentChargeLevelSettingInProgress) {
      this.currentChargeLevelSettingInProgress = true;
      setTimeout(async () => {
        await this.teslacar.setChargeLimit(
          this.currentChargeLevelSettingAdjusted
        );
        this.currentChargeLevelSettingInProgress = false;
      }, 5000);
    }
    callback(null);
  }

  handleChargeLevelOnGet(callback) {
    callback(null, true);
  }

  handleChargeLevelOnSet(value, callback) {
    callback(null);
    if (!value) {
      setTimeout(() => {
        this.chargeLevelService?.updateCharacteristic(
          this.platform.Characteristic.On,
          true
        );
      }, 1000);
    }
  }

  adjustChargeLevelToIncrement(value: number): number {
    let limit =
      Math.round(value / this.chargeLevelIncrement) * this.chargeLevelIncrement;
    if (limit < 50) {
      limit = 50;
    } else if (limit > 100) {
      limit = 100;
    }
    return limit;
  }
}
