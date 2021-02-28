import { Service, CharacteristicProps } from 'homebridge';
import { TeslaAccessory } from '../utils/ITesla';

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
  