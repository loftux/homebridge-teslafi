// import {  DynamicPlatformPlugin, Service, PlatformAccessory, Logger, PlatformConfig, Accessory } from 'homebridge';

import { PlatformAccessory, Service } from 'homebridge';
import { TeslafiPlatform } from '../platform/platform';
import { TeslaCar } from './teslaCar';

export interface ITeslaAccessory {
  getService();
  addServiceDescription(accessory: PlatformAccessory, model: string): void;
  getLatestTeslafiData(): void;
}

export abstract class TeslaAccessory implements ITeslaAccessory {
  protected currentState: any;
  protected targetState: any;
  protected service: Service;
  protected pluginServiceVersion: string;

  constructor(
    protected readonly platform: TeslafiPlatform,
    protected readonly accessory: PlatformAccessory,
    protected teslacar: TeslaCar,
    protected modelDescription: string
  ) {
    this.pluginServiceVersion = require('../../package.json').version;

    this.service = this.getService();
    this.addServiceDescription(this.accessory, modelDescription);

    this.teslacar.em.on('teslafifetch', () => {
      if (this.teslacar.skipUpdate) {
        // This should only happen once, so reset the skip if something has gone wrong elsewheeere
        this.platform.log.warn('Skipped Event for update. This should be a very rare case.');
        return;
      }
      this.getLatestTeslafiData();
    });
  }

  abstract getService(): Service;

  addServiceDescription(accessory: PlatformAccessory, model: string) {
    // set accessory information
    let service =
      accessory.getService(this.platform.Service.AccessoryInformation) ||
      accessory.addService(this.platform.Service.AccessoryInformation);

    service.setCharacteristic(
      this.platform.Characteristic.Manufacturer,
      'Loftux - Peter Löfgren'
    );
    service.setCharacteristic(this.platform.Characteristic.Model, model);
    service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.platform.config.name + ' ' + model
    );

    service.setCharacteristic(
      this.platform.Characteristic.SerialNumber,
      'Teslafi API'
    );

    // It is not possible to dynamically update firmwareRevision, so just skip this
    // service
    //  .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.platform.teslacar.carVersion);
  }

  abstract getLatestTeslafiData(): void;
}

export interface ITeslaCar {
  display_name: string;
  state: string;
  sentry_mode: boolean;
  battery: {
    charging: boolean; // carState': 'Charging'
    connected: boolean; // conn_charge_cable / Empty string of not connected
    level: number; // battery_level
    usableLevel: number; //usable_battery_level
    heater: boolean; // battery_heater_on
    range: number; // battery_range (miles)
    estimatedRange: number; // est_battery_range (miles)
  };
}
