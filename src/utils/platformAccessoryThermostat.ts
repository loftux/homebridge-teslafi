import { Service, CharacteristicProps } from 'homebridge';
import { TeslaAccessory } from './ITesla';

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

    // service
    //   .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
    //   .setProps(<CharacteristicProps>{
    //     validValues: [
    //       this.platform.Characteristic.TargetHeatingCoolingState.OFF,
    //       this.platform.Characteristic.TargetHeatingCoolingState.AUTO,
    //     ],
    //   });

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
      this.platform.log.debug(
        'Intervall updates target temp ',
        this.targetTempState
      );
    }

    if (this.actualTemp !== this.teslacar.climateControl.insideTemp) {
      this.actualTemp = this.teslacar.climateControl.insideTemp;
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        this.actualTemp
      );
    }

    let coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
      .OFF;
    //this.platform.log.debug('INTERVALL Car: ' + this.teslacar.climateControl.isClimateOn + ' target: ' + this.targetHeatingCoolingState + ' state: ' + coolingState);

    if (
      this.teslacar.climateControl.isClimateOn === false &&
      this.targetHeatingCoolingState !== coolingState
    ) {
      this.platform.log.debug(
        'Intervall set cooling to OFF ',
        this.teslacar.climateControl.isClimateOn
      );
      this.targetHeatingCoolingState = coolingState; // Set to OFF
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetHeatingCoolingState,
        coolingState
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentHeatingCoolingState,
        coolingState
      );
    } else if (this.teslacar.climateControl.isClimateOn) {
      if (this.teslacar.climateControl.insideTemp < this.targetTempState) {
        coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
          .HEAT;
        this.platform.log.debug(
          'Interval, state HEAT ' +
            this.teslacar.climateControl.insideTemp +
            ' Target: ' +
            this.targetTempState
        );
      } else {
        coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
          .COOL;
        this.platform.log.debug(
          'Interval, state COOL ' +
            this.teslacar.climateControl.insideTemp +
            ' Target: ' +
            this.targetTempState
        );
      }
      if (this.targetHeatingCoolingState !== coolingState) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHeatingCoolingState,
          coolingState
        );
        this.targetHeatingCoolingState = coolingState;
        this.platform.log.debug(
          'Intervall updates cooling state ',
          coolingState
        );
      }
    }
  }

  /**
   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
   */
  handleCurrentHeatingCoolingStateGet(callback) {
    this.platform.log.debug('Triggered GET CurrentHeatingCoolingState');

    let coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
      .OFF;

    if (this.teslacar.climateControl.isClimateOn) {
      if (this.teslacar.climateControl.insideTemp < this.targetTempState) {
        coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
          .HEAT;
      } else {
        coolingState = this.platform.Characteristic.CurrentHeatingCoolingState
          .COOL;
      }
    }

    this.platform.log.debug(
      'Triggered GET CurrentHeatingCoolingState Coolingstate: ',
      coolingState
    );
    this.targetHeatingCoolingState = coolingState;

    callback(null, coolingState);
  }

  /**
   * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
   */
  handleTargetHeatingCoolingStateGet(callback) {
    this.platform.log.debug(
      'Triggered GET TargetHeatingCoolingState',
      this.targetHeatingCoolingState
    );

    callback(null, this.targetHeatingCoolingState);
  }

  /**
   * Handle requests to set the "Target Heating Cooling State" characteristic
   */
  async handleTargetHeatingCoolingStateSet(value, callback) {
    this.platform.log.debug('Triggered SET TargetHeatingCoolingState:', value);
    let result = false;
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
      this.platform.log.debug(
        'SUCCESS Triggered SET TargetHeatingCoolingState:',
        value
      );
      this.teslacar.sleep(1);

      // if (
      //   value === this.platform.Characteristic.TargetHeatingCoolingState.COOL ||
      //   value === this.platform.Characteristic.TargetHeatingCoolingState.HEAT
      // ) {
      //   value = this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
      //   this.service.setCharacteristic(
      //     this.platform.Characteristic.TargetHeatingCoolingState,
      //     value
      //   );
      // }

      this.targetHeatingCoolingState = value;

      this.skipCount = 12;
    }
    callback(null);
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  handleCurrentTemperatureGet(callback) {
    this.platform.log.debug(
      'Triggered GET CurrentTemperature',
      this.teslacar.climateControl.insideTemp
    );

    this.actualTemp = this.teslacar.climateControl.insideTemp;

    callback(null, this.teslacar.climateControl.insideTemp);
  }

  /**
   * Handle requests to get the current value of the "Target Temperature" characteristic
   */
  handleTargetTemperatureGet(callback) {
    this.platform.log.debug(
      'Triggered GET TargetTemperature',
      this.targetTempState
    );
    if (
      !this.targetTempState ||
      this.targetTempState < this.teslacar.climateControl.minAvailTemp
    ) {
      this.targetTempState = this.teslacar.climateControl.tempSetting;
    }

    this.platform.log.debug(
      'Triggered GET TargetTemperature',
      this.targetTempState
    );
    callback(null, this.targetTempState);
  }

  /**
   * Handle requests to set the "Target Temperature" characteristic
   */
  async handleTargetTemperatureSet(value, callback) {
    this.platform.log.debug('Triggered SET TargetTemperature:', value);
    const result = await this.teslacar.setClimateTemp(value);
    if (result) {
      this.teslacar.sleep(1);

      this.targetTempState = value;

      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetTemperature,
        value
      );

      this.skipCount = 12;
    }
    callback(null);
  }

  /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsGet(callback) {
    this.platform.log.debug('Triggered GET TemperatureDisplayUnits');
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

    this.platform.log.debug('Triggered SET TemperatureDisplayUnits:', value);
    this.service.updateCharacteristic(
      this.platform.Characteristic.TemperatureDisplayUnits,
      value
    );
    this.displayUnit = value;

    callback(null);
  }
}
