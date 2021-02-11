// import {  DynamicPlatformPlugin, Service, PlatformAccessory, Logger, PlatformConfig, Accessory } from 'homebridge';

import { PlatformAccessory, Service } from 'homebridge';
import { TeslafiPlatform } from './platform';
import { TeslaCar } from './teslaCar';

export interface ITeslaAccessory {
  getService();
  addServiceDescription(accessory: PlatformAccessory, model: string): void;
  getLatestTeslafiData(): void;
}

export abstract class TeslaAccessory implements ITeslaAccessory {
  protected currentState: any;
  protected targetState: any;
  // Skip count, use to delay Teslafi API results since for example a charge request is not immediately reflected
  // on Teslafi API status until car is polled. Used in setIntervall function, set in any other when an api request
  // hasn't been sent to Teslafi
  protected skipCount = 0;
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

    //this.service.addLinkedService(this.getServiceDescription(modelDescription));

    // Init all Accessories for fetch of latest Teslafi data
    setInterval(() => {
      // Poll the current state of the car, and if changed update
      if (this.skipCount > 0) {
        // Skip running function so that teslafi has a chance to update its data
        this.skipCount--;
        return;
      }

      // Each instance implements its own data handling
      this.getLatestTeslafiData();
    }, 5000);
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
