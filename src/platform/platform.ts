import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from '../utils/settings';
import { TeslaOnlineAccessory } from './platformAccessoryOnline';
import { TeslaSentryAccessory } from './platformAccessorySentry';
import { TeslaBatteryAccessory } from './platformAccessoryBattery';
import { TeslaChargePortAccessory } from './platformAccessoryLockChargePort';
import { TeslaDoorLockAccessory } from './platformAccessoryLockDoor';
import { TeslaThermostatAccessory } from './platformAccessoryThermostat';
import { TeslafiAPI } from '../utils/api';
import { TeslaCar } from '../utils/teslaCar';
import { Dashboard} from '../dashboard/dashboard';
 
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class TeslafiPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  // Teslafi API
  public readonly teslafiapi: TeslafiAPI;
  public readonly teslacar: TeslaCar;
  public accessoryPrefix = '';

  public dashboard?: Dashboard;

  private teslaDevices = [
    {
      teslaDeviceAssessoryType: TeslaSentryAccessory,
      teslaDeviceUniqueId: this.config.name + 'TeslaSentryAccessory',
      teslaDeviceDisplayName: 'Sentry Mode',
      teslaModelDescription: 'Sentry Mode',
    },
    {
      teslaDeviceAssessoryType: TeslaOnlineAccessory,
      teslaDeviceUniqueId: this.config.name + 'TeslaOnlineAccessory',
      teslaDeviceDisplayName: 'Online Status',
      teslaModelDescription: 'Online Status',
    },
    {
      teslaDeviceAssessoryType: TeslaBatteryAccessory,
      teslaDeviceUniqueId: this.config.name + 'TeslaBatterAccessory',
      teslaDeviceDisplayName: 'Charger',
      teslaModelDescription: 'Battery Charger',
    },
    {
      teslaDeviceAssessoryType: TeslaChargePortAccessory,
      teslaDeviceUniqueId: this.config.name + 'TeslaChargePortAccessory',
      teslaDeviceDisplayName: 'Charge Port',
      teslaModelDescription: 'Charge Port',
    },
    {
      teslaDeviceAssessoryType: TeslaThermostatAccessory,
      teslaDeviceUniqueId: this.config.name + 'TeslaThermostatAccessory',
      teslaDeviceDisplayName: 'Climate',
      teslaModelDescription: 'Climate',
    },
    {
      teslaDeviceAssessoryType: TeslaDoorLockAccessory,
      teslaDeviceUniqueId: this.config.name + 'TeslaDoorLockAccessory',
      teslaDeviceDisplayName: 'Door Lock',
      teslaModelDescription: 'Door Lock',
    },
  ];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.teslafiapi = new TeslafiAPI(this.log, this.config);
    this.teslacar = new TeslaCar(log, config);

    // Set the prefix
    if (this.config['useNamePrefix'] && this.config['useNamePrefix'] === true) {
      this.accessoryPrefix = this.config.name ? this.config.name + ' ' : '';
    }

    // Init the dashboard, if path is configured
    if(this.config['dashboardImageFilePath']) {
      this.dashboard = new Dashboard(this, this.teslacar);
    }
    
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent 'duplicate UUID' errors.
   */
  discoverDevices() {
    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of this.teslaDevices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.teslaDeviceUniqueId);

      const disabled = this.config[
        'disable' + device.teslaDeviceAssessoryType.name
      ]
        ? this.config['disable' + device.teslaDeviceAssessoryType.name]
        : false;

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid
      );

      if (existingAccessory && !disabled) {
        // the accessory already exists
        this.log.info(
          'Device restore ' +
            this.accessoryPrefix +
            device.teslaDeviceDisplayName +
            ' ' +
            existingAccessory.displayName
        );
        if (device) {
          this.log.info(
            'Restoring existing accessory from cache:',
            existingAccessory.displayName
          );

          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          // existingAccessory.context.device = device;
          // this.api.updatePlatformAccessories([existingAccessory]);

          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          new device.teslaDeviceAssessoryType(
            this,
            existingAccessory,
            this.teslacar,
            device.teslaModelDescription
          );

          // update accessory cache with any changes to the accessory details and information
          this.api.updatePlatformAccessories([existingAccessory]);
        } else if (disabled) {
          // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
          // remove platform accessories when no longer present
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            existingAccessory,
          ]);
          this.log.info(
            'Removing existing accessory from cache:',
            existingAccessory.displayName
          );
        }
      } else if (!disabled) {
        // the accessory does not yet exist, so we need to create it
        this.log.info(
          'Adding new accessory:',
          this.accessoryPrefix + device.teslaDeviceDisplayName
        );

        // create a new accessory
        const accessory = new this.api.platformAccessory(
          this.accessoryPrefix + device.teslaDeviceDisplayName,
          uuid
        );

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        //new ExamplePlatformAccessory(this, accessory);

        new device.teslaDeviceAssessoryType(
          this,
          accessory,
          this.teslacar,
          device.teslaModelDescription
        );

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }

    this.accessories.forEach((accessory) => {
      let keepAccessory = false;

      for (const device of this.teslaDevices) {
        const disabled = this.config[
          'disable' + device.teslaDeviceAssessoryType.name
        ]
          ? this.config['disable' + device.teslaDeviceAssessoryType.name]
          : false;
        if (
          !disabled &&
          (device.teslaDeviceDisplayName === accessory.displayName ||
            this.accessoryPrefix + device.teslaDeviceDisplayName ===
              accessory.displayName)
        ) {
          this.log.info('Load: ' + disabled, accessory.displayName);
          keepAccessory = true;
        }
      }

      if (keepAccessory === false) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
        this.log.info('Removing existing accessory: ', accessory.displayName);
      }
    });
  }
}
