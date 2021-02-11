import { TeslaAccessory } from './ITesla';

export class TeslaChargePortAccessory extends TeslaAccessory {
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
    if (this.teslacar.chargePortOpen !== !!this.currentState) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.LockCurrentState,
        this.teslacar.chargePortOpen
          ? this.platform.Characteristic.LockTargetState.UNSECURED
          : this.platform.Characteristic.LockTargetState.SECURED
      );
    }
  }

  handleLockCurrentStateGet(callback) {
    this.teslacar.chargePortOpen
      ? (this.currentState = this.platform.Characteristic.LockTargetState.UNSECURED)
      : (this.currentState = this.platform.Characteristic.LockTargetState.SECURED);

    this.targetState = this.currentState;

    this.service.updateCharacteristic(
      this.platform.Characteristic.LockCurrentState,
      this.currentState
    );

    callback(null, this.currentState);
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

    await this.teslacar.toggleChargePortOpen(
      this.targetState === this.platform.Characteristic.LockTargetState.SECURED
        ? false
        : true
    );

    // We succeeded, so update the "current" state as well.
    // We need to update the current state "later" because Siri can't
    // handle receiving the change event inside the same "set target state"
    // response. NOTE: From homeebrdige-tesla plugin that you need to pause

    this.teslacar.sleep(1);

    this.service.setCharacteristic(
      this.platform.Characteristic.LockCurrentState,
      value
    );
    this.skipCount = 12;

    callback(null);
  }
}

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
    // if (this.teslacar.chargePortOpen !== !!this.currentState) {
    //   this.service.updateCharacteristic(
    //     this.platform.Characteristic.LockCurrentState,
    //     this.teslacar.doorLockOpen
    //       ? this.platform.Characteristic.LockTargetState.UNSECURED
    //       : this.platform.Characteristic.LockTargetState.SECURED
    //   );
    // }
    this.service
      .getCharacteristic(this.platform.Characteristic.LockCurrentState).getValue();
  }

  handleLockCurrentStateGet(callback) {
    this.teslacar.doorLockOpen
      ? (this.currentState = this.platform.Characteristic.LockTargetState.UNSECURED)
      : (this.currentState = this.platform.Characteristic.LockTargetState.SECURED);

    this.targetState = this.currentState;

    // this.service.updateCharacteristic(
    //   this.platform.Characteristic.LockCurrentState,
    //   this.currentState
    // );

    callback(null, this.currentState);
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

    await this.teslacar.toggleDoorLockOpen(
      this.targetState === this.platform.Characteristic.LockTargetState.SECURED
        ? false
        : true
    );

    // We succeeded, so update the "current" state as well.
    // We need to update the current state "later" because Siri can't
    // handle receiving the change event inside the same "set target state"
    // response. NOTE: From homeebrdige-tesla plugin that you need to pause

    this.teslacar.sleep(1);

    // this.service.setCharacteristic(
    //   this.platform.Characteristic.LockCurrentState,
    //   value
    // );
    this.skipCount = 12;

    callback(null);
  }
}
