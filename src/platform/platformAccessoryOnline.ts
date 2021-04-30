import { Service } from 'homebridge';
import { TeslaAccessory } from '../utils/ITesla';

export class TeslaOnlineAccessory extends TeslaAccessory {
  protected softwareService?: Service;
  private softwareCurrentStatus = this.platform.Characteristic.OccupancyDetected
    .OCCUPANCY_NOT_DETECTED;
  private softwareCurrentStatusName = '2003.7.1';

  private currentLocation = 'unknown';

  getService(): Service {
    let service =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.handleOnGet.bind(this))
      .on('set', this.handleOnSet.bind(this));

    // Add the software Occupancy Senser
    this.softwareService =
      this.accessory.getService(this.platform.Service.OccupancySensor) ||
      this.accessory.addService(
        this.platform.Service.OccupancySensor,
        'Software Status'
      );

    this.softwareService
      .getCharacteristic(this.platform.Characteristic.OccupancyDetected)
      .on('get', this.handlesoftwareOccupancyDetectedGet.bind(this));

    const locations: Array<string> =
      this.platform.config['taggedLocations'] || [];

    for (let l = locations.length, i = 0; i < l; i++) {
      let tempService = <Service>(
        this.accessory.getServiceById(
          this.platform.Service.OccupancySensor,
          'locationsensor_' + locations[i]
        )
      );
      if (!tempService) {
        tempService = new this.platform.Service.OccupancySensor(
          this.platform.accessoryPrefix + locations[i],
          'locationsensor_' + locations[i]
        );
        if (tempService) {
          this.accessory.addService(tempService);
        }
      }
      if (tempService) {
        // Update the name in case config has change to use/not use accessory prefix
        tempService.updateCharacteristic(
          this.platform.Characteristic.Name,
          this.platform.accessoryPrefix + locations[i]
        );

        tempService
          .getCharacteristic(this.platform.Characteristic.OccupancyDetected)
          .on(
            'get',
            ((callback, location = locations[i]) => {
              this._getCurrentState();
              const statusOccupancy =
                location === this.currentLocation
                  ? this.platform.Characteristic.OccupancyDetected
                      .OCCUPANCY_DETECTED
                  : this.platform.Characteristic.OccupancyDetected
                      .OCCUPANCY_NOT_DETECTED;

              callback(null, statusOccupancy);
            }).bind(this)
          );
      }
    }

    this.accessory.services.forEach((s) => {
      if (s.subtype && s.subtype?.indexOf('locationsensor') > -1) {
        let locationName = s.displayName;
        if (this.platform.accessoryPrefix) {
          // Prefix is used, grab the en part
          const locationPart = s.displayName.split(' ');
          if (locationPart.length > 1) {
            locationName = locationPart[1];
          }
        }

        if (!(locations.indexOf(locationName) > -1)) {
          this.platform.log.info('Removing location Sensor', s.displayName);
          this.accessory.removeService(s);
        }
      }
    });

    return service;
  }

  getLatestTeslafiData(): void {
    const oldState = this.currentState;
    const oldsoftwareCurrentStatus = this.softwareCurrentStatus;
    const oldsoftwareCurrentStatusName = this.softwareCurrentStatusName;
    const oldCurrentLocation = this.currentLocation;

    this._getCurrentState();
    if (oldState !== this.currentState) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState
      );
    }

    if (oldsoftwareCurrentStatus !== this.softwareCurrentStatus) {
      this.softwareService?.updateCharacteristic(
        this.platform.Characteristic.OccupancyDetected,
        this.softwareCurrentStatus
      );
    }

    if (oldsoftwareCurrentStatusName !== this.softwareCurrentStatusName) {
      this.softwareService?.updateCharacteristic(
        this.platform.Characteristic.ConfiguredName,
        this.softwareCurrentStatusName
      );
    }

    if (oldCurrentLocation !== this.currentLocation) {
      const locations: [] = this.platform.config['taggedLocations'] || [];

      for (let l = locations.length, i = 0; i < l; i++) {
        const tempService = <Service>(
          this.accessory.getServiceById(
            this.platform.Service.OccupancySensor,
            'locationsensor_' + locations[i]
          )
        );
        if (tempService) {
          tempService.updateCharacteristic(
            this.platform.Characteristic.OccupancyDetected,
            tempService.displayName ===
              this.platform.accessoryPrefix + this.currentLocation
              ? this.platform.Characteristic.OccupancyDetected
                  .OCCUPANCY_DETECTED
              : this.platform.Characteristic.OccupancyDetected
                  .OCCUPANCY_NOT_DETECTED
          );
        }
      }
    }
  }

  _getCurrentState(): void {
    this.currentState =
      this.platform.teslacar.state === 'online' ? true : false;

    switch (this.teslacar.software.status) {
      case 'downloading_wifi_wait':
        this.softwareCurrentStatusName =
          this.teslacar.software.new + ' Waiting for Wifi';
        break;
      case 'scheduled':
        this.softwareCurrentStatusName =
          this.teslacar.software.new + ' Scheduled to install';
        break;
      case 'downloading':
        this.softwareCurrentStatusName =
          this.teslacar.software.new + ' Downloading';
        break;
      case 'installing':
        this.softwareCurrentStatusName =
          this.teslacar.software.new + ' Installing';
        break;
      case 'available':
        this.softwareCurrentStatusName =
          this.teslacar.software.new + ' Available for install';
        break;
      default:
        this.softwareCurrentStatusName =
          this.teslacar.software.new + ' Installed';
    }

    if (this.platform.accessoryPrefix) {
      // Add prefix of car name if needed.
      this.softwareCurrentStatusName =
        this.platform.accessoryPrefix + this.softwareCurrentStatusName;
    }

    this.teslacar.software.status
      ? (this.softwareCurrentStatus = this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED)
      : (this.softwareCurrentStatus = this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);

    this.currentLocation = this.teslacar.location;
  }
  handleOnGet(callback) {
    this._getCurrentState();
    callback(null, this.currentState);
  }

  handlesoftwareOccupancyDetectedGet(callback) {
    this._getCurrentState();
    callback(null, this.softwareCurrentStatus);
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleOnSet(value, callback) {
    if (value) {
      callback(null);
      // When we reset the satus of The switch, handleOnSet will be called, so check if car is already online before calling wake_up
      if (this.platform.teslacar.state !== 'online') {
        await this.teslacar.wakeUp().then(() => {
          this.platform.teslacar.state = 'online';
          this.currentState = true;
          this.service.updateCharacteristic(
            this.platform.Characteristic.On,
            this.currentState
          );
        });
      }
    } else {
      callback(null);

      if (this.platform.teslacar.sentry_mode === true  || this.platform.teslacar.battery.charging === true) {
        // Set switch state back, we cannot attempt to sleep when sentry mode is on. Or charging.
        if (this.platform.teslacar.state === 'online') {
          setTimeout(() => {
            this.service.updateCharacteristic(
              this.platform.Characteristic.On,
              true
            );
          }, 1000);
        }
      } else {
        if (this.platform.teslacar.state === 'online') {
          await this.teslacar.sleep().then(() => {
            this.platform.teslacar.state = 'offline';
            this.currentState = false;
            this.service.updateCharacteristic(
              this.platform.Characteristic.On,
              this.currentState
            );
          });
        }
      }
    }
  }
}
