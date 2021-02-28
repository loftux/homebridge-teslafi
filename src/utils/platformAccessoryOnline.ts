import { Service } from 'homebridge';
import { TeslaAccessory } from './ITesla';

export class TeslaOnlineAccessory extends TeslaAccessory {
  getService(): Service {
    let service =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.handleOnGet.bind(this))
      .on('set', this.handleOnSet.bind(this));

    return service;
  }

  getLatestTeslafiData(): void {
    const oldState = this.currentState;
    this._getCurrentState();
    if (oldState !== this.currentState) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState
      );
    }
  }

  _getCurrentState(): void {
    this.currentState =
      this.platform.teslacar.state === 'asleep' ? false : true;
  }
  handleOnGet(callback) {
    this._getCurrentState();
    callback(null, this.currentState);
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
