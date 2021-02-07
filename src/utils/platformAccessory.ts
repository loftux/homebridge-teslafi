import { Service, CharacteristicProps } from 'homebridge';
import { TeslaAccessory } from './ITesla';

export class TeslaOnlineAccessory extends TeslaAccessory {
  getService(): Service {
    // initiate as online
    this.currentState = 'online';

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
    if (this.currentState !== this.platform.teslacar.state) {
      const onlineStatus =
        this.platform.teslacar.state === 'asleep' ? false : true;

      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        onlineStatus
      );
      this.currentState = this.platform.teslacar.state;
    }
  }

  handleOnGet(callback) {
    //this.platform.log.debug("Triggered Online status GET");

    // set this to a valid value for On
    const onlineStatus =
      this.platform.teslacar.state === 'asleep' ? false : true;

    this.currentState = this.platform.teslacar.state;

    callback(null, onlineStatus);
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleOnSet(value, callback) {
    //this.platform.log.debug( "Triggered Online status SET: " + value + " Car status: " + this.platform.teslacar.state );

    if (value) {
      // When we reset the satus of The switch, handleOnSet will be called, so check if car is already online before calling wake_up
      if (this.platform.teslacar.state !== 'online') {
        await this.teslacar.wakeUp();
        this.platform.teslacar.state = 'online';
        this.skipCount = 12;
      }

      this.currentState = 'online';
    } else {
      // Ignors since we cannot set the car asleep
      // Set the current state to asleep anyways, so the it corrects itself
      this.currentState = 'asleep';
    }

    callback(null);
  }
}

export class TeslaBatteryAccessory extends TeslaAccessory {
  protected currentBatteryLevel = 50;
  protected currentCableConnectionStatus = false;
  protected batteryService?: Service;

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
    if (this.currentState !== this.teslacar.battery.charging) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        this.teslacar.battery.charging
      );
      this.currentState = this.teslacar.battery.charging;
    }

    if (
      this.currentBatteryLevel !== this.teslacar.battery.level &&
      this.batteryService
    ) {
      this.batteryService.updateCharacteristic(
        this.platform.Characteristic.BatteryLevel,
        this.teslacar.battery.level
      );
      this.currentBatteryLevel = this.teslacar.battery.level;
    }

    if(this.currentCableConnectionStatus !== this.teslacar.battery.connected) {
      this.currentCableConnectionStatus === this.teslacar.battery.connected;
      //this.platform.log.debug('CABLE Connction status', this.currentCableConnectionStatus);
      this.service.updateCharacteristic(this.platform.Characteristic.OutletInUse, this.currentCableConnectionStatus);
    }
  }

  handleOutletInUseGet(callback) {
    this.currentCableConnectionStatus = this.teslacar.battery.connected;
    //this.platform.log.debug('GET CABLE Connction status', this.currentCableConnectionStatus);
    callback(null, this.currentCableConnectionStatus);
  }

  handleChargeOnGet(callback) {
    //this.platform.log.debug("Triggered Online status GET");

    // set this to a valid value for On
    const charging = this.platform.teslacar.battery.charging;

    this.currentState = charging;

    callback(null, charging);
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleChargeOnSet(value, callback) {
    //this.platform.log.debug("Triggered Charge SET: " + value);

    // Only try to start if charge cable connected
    if (
      value &&
      this.currentState === false &&
      this.platform.teslacar.battery.connected === true
    ) {
      //this.platform.log.debug("Start Charging");
      await this.teslacar.toggleCharging(true);
      this.platform.teslacar.battery.charging = true;
      this.currentState = value;
      this.skipCount = 12;
      callback(null, value);
    } else if (
      !value &&
      this.currentState === true &&
      this.platform.teslacar.battery.connected === true
    ) {
      //this.platform.log.debug("Start Charging");
      await this.teslacar.toggleCharging(false);
      this.platform.teslacar.battery.charging = false;
      this.currentState = value;
      this.skipCount = 12;
      callback(null, value);
    } else {
      // Ignore since we cannot start charging when disconnected
      this.currentState = value;
      callback(null, false);
    }
  }

  /**
   * Handle requests to get the current value of the "Battery Level" characteristic
   */
  handleBatteryLevelGet(callback) {
    //this.platform.log.debug("Triggered GET BatteryLevel " + this.teslacar.battery.level );

    // set this to a valid value for BatteryLevel
    const currentValue = this.teslacar.battery.level;
    this.currentBatteryLevel = currentValue;

    callback(null, currentValue);
  }

  /**
   * Handle requests to get the current value of the "Charging State" characteristic
   */
  handleChargingStateGet(callback) {
    //this.platform.log.debug("Triggered GET ChargingState");

    // set this to a valid value for ChargingState
    let currentValue = this.platform.Characteristic.ChargingState.NOT_CHARGING;
    //this.platform.log.debug("Is connected: " + this.teslacar.battery.connected + " Is Chargning " + this.teslacar.battery.charging);
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
    const lowBatterLevel = this.platform.config['lowBatterylevel']
      ? this.platform.config['lowBatterylevel']
      : 20;
    const currentValue =
      this.teslacar.battery.level < <number>lowBatterLevel
        ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
    //this.platform.log.debug("Triggered GET StatusLowBattery Level: " + this.teslacar.battery.level + " Warn Level " + lowBatterLevel );
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
    const state = this.teslacar.sentry_mode
      ? this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM
      : this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
    if (state !== this.currentState) {
      //this.platform.log.debug("Intervall check - change detected");
      this.targetState = this.currentState = state;
      this.service.updateCharacteristic(
        this.platform.Characteristic.SecuritySystemTargetState,
        this.currentState
      );
    }
  }

  /**
   * Handle requests to get the current value of the 'Security System Current State' characteristic
   */
  handleSecuritySystemCurrentStateGet(callback) {
    // set this to a valid value for SecuritySystemCurrentState
    this.currentState = this.teslacar.sentry_mode
      ? this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM
      : this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;

    //this.platform.log.debug( "Triggered GET SecuritySystemCurrentState " + this.currentState);

    // Set the alarm target state to the current state, else homekit will try to change state if not equal.
    this.targetState = this.currentState;
    this.service.updateCharacteristic(
      this.platform.Characteristic.SecuritySystemTargetState,
      this.currentState
    );
    callback(null, this.currentState);
  }

  /**
   * Handle requests to get the current value of the 'Security System Target State' characteristic
   */
  handleSecuritySystemTargetStateGet(callback) {
    //this.platform.log.debug("Triggered GET SecuritySystemTargetState " + this.targetState);

    callback(null, this.targetState);
  }

  /**
   * Handle requests to set the 'Security System Target State' characteristic
   */
  async handleSecuritySystemTargetStateSet(state, callback) {
    //this.platform.log.debug("Triggered SET SecuritySystemTargetState:" + state);
    this.targetState = state;

    if (state !== this.currentState) {
      //this.platform.log.debug("Update needed ***");
      // Updating TeslaCar, the actual update from polll comes later
      state === 1
        ? (this.teslacar.sentry_mode = true)
        : (this.teslacar.sentry_mode = false);

      await this.teslacar.toggleSentryMode(state === 1 ? true : false);
    }

    // Teslafi does not update the car status right away, only after the 30 sek poll.
    // So we can ignore the result, and hope that 200 response means ok.

    this.teslacar.sleep(1);

    this.service.setCharacteristic(
      this.platform.Characteristic.SecuritySystemCurrentState,
      state
    );
    this.skipCount = 12; // 60 seconds

    callback(null, state);
  }
}
