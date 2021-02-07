import { API } from 'homebridge';

import { PLATFORM_NAME } from './utils/settings';
import { TeslafiPlatform } from './utils/platform'; 

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  //console.log('Starting ' + PLATFORM_NAME);

  api.registerPlatform(PLATFORM_NAME, TeslafiPlatform);

};