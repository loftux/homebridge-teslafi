import { Service, CharacteristicProps } from 'homebridge';
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
    this.service.getCharacteristic(this.platform.Characteristic.On).getValue();
  }

  handleOnGet(callback) {
    // set this to a valid value for On
    const onlineStatus =
      this.platform.teslacar.state === 'asleep' ? false : true;

    callback(null, onlineStatus);
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleOnSet(value, callback) {
    if (value) {
      // When we reset the satus of The switch, handleOnSet will be called, so check if car is already online before calling wake_up
      if (this.platform.teslacar.state !== 'online') {
        await this.teslacar.wakeUp();
        this.platform.teslacar.state = 'online';
        this.skipCount = 12;
      }
    } else {
      // Ignors since we cannot set the car asleep
    }

    callback(null);
  }
}

export class TeslaBatteryAccessory extends TeslaAccessory {
  protected batteryService?: Service;

  protected lowBatteryLevel = this.platform.config['lowBatterylevel']
    ? <number>this.platform.config['lowBatterylevel']
    : 20;

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
    // Poll the current state of the car, and if changed update
    this.service.getCharacteristic(this.platform.Characteristic.On).getValue();

    this.batteryService
      ?.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .getValue();

    this.service
      .getCharacteristic(this.platform.Characteristic.OutletInUse)
      .getValue();

    this.batteryService
      ?.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .getValue();
    // Update the charging state if it has changed.
    this.service
      .getCharacteristic(this.platform.Characteristic.ChargingState)
      .getValue();
  }

  handleOutletInUseGet(callback) {
    callback(null, this.teslacar.battery.connected);
  }

  handleChargeOnGet(callback) {
    callback(null, this.platform.teslacar.battery.charging);
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
      this.skipCount = 12;
      callback(null);
    } else if (
      !value &&
      this.currentState === true &&
      this.platform.teslacar.battery.connected === true
    ) {
      await this.teslacar.toggleCharging(false);
      this.platform.teslacar.battery.charging = false;
      this.currentState = value;
      this.skipCount = 12;
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
    callback(null, this.teslacar.battery.level);
  }

  /**
   * Handle requests to get the current value of the "Charging State" characteristic
   */
  handleChargingStateGet(callback) {
    // set this to a valid value for ChargingState
    let currentValue = this.platform.Characteristic.ChargingState.NOT_CHARGING;

    if (!this.teslacar.battery.connected) {
      currentValue = this.platform.Characteristic.ChargingState.NOT_CHARGEABLE;
    }
    if (this.teslacar.battery.charging) {
      currentValue = this.platform.Characteristic.ChargingState.CHARGING;
    }

    callback(null, currentValue);
  }

  /**
   * Handle requests to get the current value of the "Status Low Battery" characteristic
   */
  handleStatusLowBatteryGet(callback) {
    // set this to a valid value for StatusLowBattery
    // Low warning level

    const currentValue =
      this.teslacar.battery.level <= <number>this.lowBatteryLevel
        ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
    callback(null, currentValue);
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
    this.service
      .getCharacteristic(
        this.platform.Characteristic.SecuritySystemCurrentState
      )
      .getValue();
  }

  /**
   * Handle requests to get the current value of the 'Security System Current State' characteristic
   */
  handleSecuritySystemCurrentStateGet(callback) {
    // set this to a valid value for SecuritySystemCurrentState
    this.teslacar.sentry_mode
      ? (this.currentState = this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM)
      : (this.currentState = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED);

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
    if (state !== this.currentState) {
      const result = await this.teslacar.toggleSentryMode(
        state === 1 ? true : false
      );
      if (result) {
        this.currentState = state;

        this.teslacar.sleep(1);

        this.skipCount = 12; // 60 seconds

        state === 1
          ? (this.teslacar.sentry_mode = true)
          : (this.teslacar.sentry_mode = false);

        callback(null);

        this.service
          .getCharacteristic(
            this.platform.Characteristic.SecuritySystemCurrentState
          )
          .getValue();
      } else {
        callback('Error');
      }
    }
  }
}
