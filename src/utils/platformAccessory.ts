import { Service, CharacteristicProps, Characteristic } from 'homebridge';
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

export class TeslaBatteryAccessory extends TeslaAccessory {
  protected batteryService?: Service;

  protected lowBatteryLevel = this.platform.config['lowBatterylevel']
    ? <number>this.platform.config['lowBatterylevel']
    : 20;

  protected currentStateOutletInUse = false;
  protected currentStateBattereyLevel = 100;
  protected currentStateCharging = 0;
  protected currentStateBatteryLevelLow = 0;

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

    service.addLinkedService(this.batteryService);

    return service;
  }

  getLatestTeslafiData(): void {
    const oldCurrentStateBattereyLevel = this.currentStateBattereyLevel;
    const oldCurrentStateBatteryLevelLow = this.currentStateBatteryLevelLow;
    const oldCurrentStateOutletInUse = this.currentStateOutletInUse;
    const oldCurrentStateCharging = this.currentStateCharging;
    const oldCurrentState = this.currentState;

    this._updateCurrentState();

    if (oldCurrentStateBattereyLevel !== this.currentStateBattereyLevel) {
      this.batteryService?.updateCharacteristic(
        this.platform.Characteristic.BatteryLevel,
        this.currentStateBattereyLevel
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
}

export class TeslaSentryAccessory extends TeslaAccessory {
  getService(): Service {
    let service =
      this.accessory.getService(this.platform.Service.SecuritySystem) ||
      this.accessory.addService(this.platform.Service.SecuritySystem);

    // Override default allow values since Sentry only allows 'on/off'
    // 1=AWAY_ARM - ON, 3=DISARMED - OFF, 4=ALARM_TRIGGERED
    service
      .getCharacteristic(
        this.platform.Characteristic.SecuritySystemCurrentState
      )
      .setProps(<CharacteristicProps>{
        validValues: [1, 3],
      });

    service
      .getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .setProps(<CharacteristicProps>{
        validValues: [1, 3],
      });

    service
      .getCharacteristic(
        this.platform.Characteristic.SecuritySystemCurrentState
      )
      .on('get', this.handleSecuritySystemCurrentStateGet.bind(this));

    service
      .getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .on('get', this.handleSecuritySystemTargetStateGet.bind(this));

    service
      .getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .on('set', this.handleSecuritySystemTargetStateSet.bind(this));

    return service;
  }

  getLatestTeslafiData() {
    const oldState = this.currentState;
    this._updateCurrentState();
    if (oldState !== this.currentState) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.SecuritySystemCurrentState,
        this.currentState
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.SecuritySystemTargetState,
        this.currentState
      );
    }
  }

  _updateCurrentState(): void {
    // set this to a valid value for SecuritySystemCurrentState
    this.teslacar.sentry_mode
      ? (this.currentState = this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM)
      : (this.currentState = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED);
  }
  /**
   * Handle requests to get the current value of the 'Security System Current State' characteristic
   */
  handleSecuritySystemCurrentStateGet(callback) {
    this._updateCurrentState();
    callback(null, this.currentState);
  }

  /**
   * Handle requests to get the current value of the 'Security System Target State' characteristic
   */
  handleSecuritySystemTargetStateGet(callback) {
    callback(null, this.currentState);
  }

  /**
   * Handle requests to set the 'Security System Target State' characteristic
   */
  async handleSecuritySystemTargetStateSet(state, callback) {
    callback(null);

    if (state !== this.currentState) {
      this.currentState = state;

      await this.teslacar
        .toggleSentryMode(state === 1 ? true : false)
        .then((result) => {
          if (result) {
            this.service.updateCharacteristic(
              this.platform.Characteristic.SecuritySystemCurrentState,
              this.currentState
            );
            this.service.updateCharacteristic(
              this.platform.Characteristic.SecuritySystemTargetState,
              this.currentState
            );
          }
        });
    }
  }
}
