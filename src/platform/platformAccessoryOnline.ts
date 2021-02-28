import { Service } from 'homebridge';
import { TeslaAccessory } from '../utils/ITesla';

export class TeslaOnlineAccessory extends TeslaAccessory {
  protected softwareService?: Service;
  private softwareCurrentStatus = this.platform.Characteristic.OccupancyDetected
    .OCCUPANCY_NOT_DETECTED;
  private softwareCurrentStatusName = '';

  getService(): Service {
    let service =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.handleOnGet.bind(this))
      .on('set', this.handleOnSet.bind(this));

    // Add the battery Service
    this.softwareService =
      this.accessory.getService(this.platform.Service.OccupancySensor) ||
      this.accessory.addService(this.platform.Service.OccupancySensor);
    this.softwareService.setCharacteristic(
      this.platform.Characteristic.Name,
      this.softwareCurrentStatusName
    );

    this.softwareService
      .getCharacteristic(this.platform.Characteristic.OccupancyDetected)
      .on('get', this.handlesoftwareOccupancyDetectedGet.bind(this));

    return service;
  }

  getLatestTeslafiData(): void {
    const oldState = this.currentState;
    const oldsoftwareCurrentStatus = this.softwareCurrentStatus;
    const oldsoftwareCurrentStatusName = this.softwareCurrentStatusName

    this._getCurrentState();
    if (oldState !== this.currentState) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState
      );
    }

    if(oldsoftwareCurrentStatus !== this.softwareCurrentStatus) {
      this.softwareService?.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, this.softwareCurrentStatus)
    }

    if(oldsoftwareCurrentStatusName !== this.softwareCurrentStatusName) {
      this.softwareService?.updateCharacteristic(this.platform.Characteristic.Name, this.softwareCurrentStatusName);
    }
  }

  _getCurrentState(): void {
    this.currentState =
      this.platform.teslacar.state === 'asleep' ? false : true;

    switch (this.teslacar.software.status) {
      case 'downloading_wifi_wait':
        this.softwareCurrentStatusName =
          this.teslacar.software.new + ' Waiting for Wifi';
        break;
      case 'scheduled':
        this.softwareCurrentStatusName =
          this.teslacar.software.new + ' Schedule to install';
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

    this.teslacar.software.status
      ? (this.softwareCurrentStatus = this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED)
      : (this.softwareCurrentStatus = this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);

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

      // Set switch state back
      if (this.platform.teslacar.state === 'online') {
        setTimeout(() => {
          this.service.updateCharacteristic(
            this.platform.Characteristic.On,
            true
          );
        }, 1000);
      }
    }
  }
}
