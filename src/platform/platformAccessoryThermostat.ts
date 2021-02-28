import { CharacteristicProps } from 'homebridge';
import { TeslaAccessory } from '../utils/ITesla';

export class TeslaThermostatAccessory extends TeslaAccessory {
  private targetHeatingCoolingState = 0;
  private targetTempState = 0;
  private actualTemp = 0;

  private displayUnit = -1;

  getService() {
    let service =
      this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    service
      .getCharacteristic(
        this.platform.Characteristic.CurrentHeatingCoolingState
      )
      .on('get', this.handleCurrentHeatingCoolingStateGet.bind(this));

    service
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .on('get', this.handleTargetHeatingCoolingStateGet.bind(this))
      .on('set', this.handleTargetHeatingCoolingStateSet.bind(this));

    service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on('get', this.handleCurrentTemperatureGet.bind(this));

    // Update min value from 0, max is already100

    service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .setProps(<CharacteristicProps>{
        minValue: -100,
      });

    service
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .on('get', this.handleTargetTemperatureGet.bind(this))
      .on('set', this.handleTargetTemperatureSet.bind(this));

    service
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps(<CharacteristicProps>{
        minValue: this.teslacar.climateControl.minAvailTemp,
        maxValue: this.teslacar.climateControl.maxAvailTemp,
        minStep: 0.5,
      });

    service
      .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .on('get', this.handleTemperatureDisplayUnitsGet.bind(this))
      .on('set', this.handleTemperatureDisplayUnitsSet.bind(this));

    return service;
  }

  getLatestTeslafiData(): void {
    if (this.targetTempState !== this.teslacar.climateControl.tempSetting) {
      this.targetTempState = this.teslacar.climateControl.tempSetting;
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetTemperature,
        this.targetTempState
      );
    }

    let oldHeatingCoolingState = this.targetHeatingCoolingState;
    let oldTemp = this.actualTemp;

    this._updateCurrentState();

    if (oldHeatingCoolingState !== this.targetHeatingCoolingState) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentHeatingCoolingState,
        this.targetHeatingCoolingState
      );
    }

    if (oldTemp !== this.actualTemp) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        this.actualTemp
      );
    }
  }

  _updateCurrentState(): void {
    // Current Temperature
    this.actualTemp = this.teslacar.climateControl.insideTemp;

    // CoolingState
    let coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
      .OFF;

    if (this.teslacar.climateControl.isClimateOn) {
      if (this.teslacar.climateControl.insideTemp < this.targetTempState) {
        coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
          .HEAT;
      } else if (
        this.teslacar.climateControl.insideTemp > this.targetTempState
      ) {
        coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
          .COOL;
      } else {
        // It is equal, check outside temp if we are heating or cooling
        if (this.targetTempState > this.teslacar.climateControl.outsideTemp) {
          coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
            .HEAT;
        } else {
          coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
            .COOL;
        }
      }
    }
    this.targetHeatingCoolingState = coolingState;
  }

  /**
   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
   */
  handleCurrentHeatingCoolingStateGet(callback) {
    this._updateCurrentState();
    callback(null, this.targetHeatingCoolingState);
  }

  /**
   * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
   */
  handleTargetHeatingCoolingStateGet(callback) {
    callback(null, this.targetHeatingCoolingState);
  }

  /**
   * Handle requests to set the "Target Heating Cooling State" characteristic
   */
  async handleTargetHeatingCoolingStateSet(value, callback) {
    let result = false;
    callback(null);

    if (this.targetHeatingCoolingState === value) {
      // Avoid duplicate calls, the Homekit control seem to do that
      return;
    }

    this.targetHeatingCoolingState = value;

    if (
      value === this.platform.Characteristic.TargetHeatingCoolingState.OFF &&
      this.teslacar.climateControl.isClimateOn
    ) {
      // Desired state is off, and the climate is actually off
      result = await this.teslacar.toggleClimateOn(false);
    } else if (
      value !== this.platform.Characteristic.TargetHeatingCoolingState.OFF &&
      !this.teslacar.climateControl.isClimateOn
    ) {
      // State is something else than OFF, and climate is not already turned on
      result = await this.teslacar.toggleClimateOn(true);
    }

    if (result) {
      setTimeout(() => {
        // Call this and it will be quicker to update homekit status
        this._updateCurrentState();
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHeatingCoolingState,
          this.targetHeatingCoolingState
        );
      }, 1000);
    }
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  handleCurrentTemperatureGet(callback) {
    callback(null, this.actualTemp);
  }

  /**
   * Handle requests to get the current value of the "Target Temperature" characteristic
   */
  handleTargetTemperatureGet(callback) {
    if (
      !this.targetTempState ||
      this.targetTempState < this.teslacar.climateControl.minAvailTemp
    ) {
      this.targetTempState = this.teslacar.climateControl.tempSetting;
    }

    callback(null, this.targetTempState);
  }

  /**
   * Handle requests to set the "Target Temperature" characteristic
   */
  async handleTargetTemperatureSet(value, callback) {
    const result = await this.teslacar.setClimateTemp(value);
    if (result) {
      this.targetTempState = this.teslacar.climateControl.tempSetting = value;
    }
    callback(null);
  }

  /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsGet(callback) {
    if (this.displayUnit < 0) {
      this.teslacar.tempUnit === 'C'
        ? (this.displayUnit = this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS)
        : (this.displayUnit = this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
    }

    callback(null, this.displayUnit);
  }

  /**
   * Handle requests to set the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsSet(value, callback) {
    /**
     * This does not actuall change anything. All values are handled in Celcius,
     * Homekit will automatically convert based on IOS system settings.
     * The characteristic is meant to change what is shown on the physical thermostat.
     */

    this.displayUnit = value;

    callback(null);
  }
}
