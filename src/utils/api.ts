import fetch from 'node-fetch';
import { Logger, PlatformConfig } from 'homebridge';

export class TeslafiAPI {
  private wakeupTimeout: number;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig
  ) {
    config['wakeupTimeout'] && !isNaN(<number>config['wakeupTimeout'])
      ? (this.wakeupTimeout = <number>config['wakeupTimeout'])
      : (this.wakeupTimeout = 15);

    this.log.debug('Initalized Teslafi API', this.config.name);
    this.log.debug('Timeout: ', this.wakeupTimeout);
  }

  public async action(command: string, parameter: string): Promise<any> {
    this.log.debug(
      'Teslafi API command ' + command + ' parameter ' + parameter
    );
    try {
      let url =
        'https://teslafi.com/feed.php?source=homebridge&encode=1&token=' +
        this.config['token'];

      let wakeUp = '';
      if (this.wakeupTimeout > 0) {
        // User has configure the car to be woken if sleeping when command is sent
        wakeUp = '&wake=' + this.wakeupTimeout;
      }

      switch (command) {
        case 'wake':
        case 'enableLogging':
        case 'disableLogging':
        case 'honk':
        case 'flash_lights':
        case 'auto_conditioning_start':
        case 'auto_conditioning_stop':
        case 'charge_start':
        case 'charge_stop':
        case 'door_unlock':
        case 'door_lock':
        case 'charge_port_door_open':
        case 'charge_port_door_close':
          url += '&command=' + command;
          break;

        case 'wake_up':
          url += '&command=' + command;
          // We do not need to wake up on wake_up :)
          wakeUp = '';
          break;

        case 'set_charge_limit':
          // Set Charge Limit	command=set_charge_limit&charge_limit_soc=XX
          url += '&command=' + command + '&charge_limit=' + parameter;
          break;

        case 'set_sentry_mode':
          // Sentry Mode	command=set_sentry_mode&sentryMode=(true or false)
          url += '&command=' + command + '&sentryMode=' + parameter;
          break;

        case 'set_preconditioning_max':
          // Max Defrost (When turned off conditioning remains on)	command=set_preconditioning_max&statement=(true or false)
          url += '&command=' + command + '&statement=' + parameter;
          break;

        case 'set_temps':
          url += '&command=' + command + '&temp=' + parameter;
          break;

        default:
          wakeUp = ''; // Reset wakeup, we shouldn't wake the car for just data retrieval
        // Do nothing, just retrieve vehicle data
      }

      this.log.debug('Fetching: ' + url + wakeUp);

      const response = await fetch(url + wakeUp);

      return await response.json();
    } catch (error) {
      this.log.error('Teslafi API error:', error);
      if (typeof error === 'string') {
        throw new Error(error);
      }

      throw error;
    }
  }
}
