import { TeslaAccessory } from './ITesla';

export class TeslaDoorLockAccessory extends TeslaAccessory {
  getService() {
    this.currentState = this.platform.Characteristic.LockTargetState.SECURED;
    this.targetState = this.platform.Characteristic.LockTargetState.SECURED;

    let service =
      this.accessory.getService(this.platform.Service.LockMechanism) ||
      this.accessory.addService(this.platform.Service.LockMechanism);

    service
      .getCharacteristic(this.platform.Characteristic.LockCurrentState)
      .on('get', this.handleLockCurrentStateGet.bind(this));

    service
      .getCharacteristic(this.platform.Characteristic.LockTargetState)
      .on('get', this.handleLockTargetStateGet.bind(this))
      .on('set', this.handleLockTargetStateSet.bind(this));

    return service;
  }
  getLatestTeslafiData(): void {
    const oldValue = this.currentState;
    this._updateLockCurrentState();
    if (oldValue !== this.currentState) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.LockCurrentState,
        this.currentState
      );
    }
  }

  handleLockCurrentStateGet(callback) {
    this._updateLockCurrentState();
    this.targetState = this.currentState;
    callback(null, this.currentState);
  }

  _updateLockCurrentState(): void {
    this.teslacar.doorLockOpen
      ? (this.currentState = this.platform.Characteristic.LockTargetState.UNSECURED)
      : (this.currentState = this.platform.Characteristic.LockTargetState.SECURED);
  }

  /**
   * Handle requests to get the current value of the "Lock Target State" characteristic
   */
  handleLockTargetStateGet(callback) {
    callback(null, this.targetState);
  }

  /**
   * Handle requests to set the "Lock Target State" characteristic
   */
  async handleLockTargetStateSet(value, callback) {
    this.targetState = value;
    callback(null);

    await this.teslacar
      .toggleDoorLockOpen(
        this.targetState ===
          this.platform.Characteristic.LockTargetState.SECURED
          ? false
          : true
      )
      .then((result) => {
        if (result) {
          this.service.updateCharacteristic(
            this.platform.Characteristic.LockCurrentState,
            this.targetState
          );
        }
      });
  }
}
