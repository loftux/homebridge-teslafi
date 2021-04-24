import { TeslafiPlatform } from '../platform/platform';
import { TeslaCar } from '../utils/teslaCar';
import nodeHtmlToImage from 'node-html-to-image';
import * as fs from 'fs';
import * as path from 'path';

export class Dashboard {
    private rangeUnit: string;
    private tempUnit: string;
    private softwareCurrentStatusName = '2003.7.1';

  constructor(
    protected readonly platform: TeslafiPlatform,
    protected teslacar: TeslaCar
  ) {

    const buffer = fs.readFileSync(path.join(__dirname, 'template.html'))
    const htmlTemplate = buffer.toString('utf8')

    this.platform.log.debug('INIT dashboard');

    this.rangeUnit = <string>this.platform.config['rangeUnit'];
    this.tempUnit = <string>this.platform.config['tempUnit'];


    this.teslacar.em.on('teslafifetch', () => {
      if (this.teslacar.skipUpdate) {
        // This should only happen once, so reset the skip if something has gone wrong elsewheeere
        return;
      }

      switch (this.teslacar.software.status) {
        case 'downloading_wifi_wait':
          this.softwareCurrentStatusName =
            this.teslacar.software.new + ' Waiting for Wifi';
          break;
        case 'scheduled':
          this.softwareCurrentStatusName =
            this.teslacar.software.new + ' Scheduled to install';
          break;
        case 'downloading':
          this.softwareCurrentStatusName =
            this.teslacar.software.new + ' Downloading';
          break;
        case 'installing':
          this.softwareCurrentStatusName =
            this.teslacar.software.new + ' Installing';
          break;
        case 'available':
          this.softwareCurrentStatusName =
            this.teslacar.software.new + ' Available for install';
          break;
        default:
          this.softwareCurrentStatusName =
            this.teslacar.software.new + ' Installed';
      }

      nodeHtmlToImage({
        output: './' + this.platform.config.name + '_dashboard.png',
        html: htmlTemplate,
        content: { 
            batteryLevel: this.teslacar.battery.level,
            batteryLimit: this.teslacar.battery.chargeLimit,
            batteryUsableLevel: this.teslacar.battery.usableLevel,
            range: this.teslacar.battery.range,
            rangeEstimated: this.teslacar.battery.estimatedRange,
            rangeUnit: this.rangeUnit.toLowerCase(),
            tempInside: this.tempUnit === 'F' ? Math.round(this.teslacar.climateControl.insideTemp * 9/5 + 32) : this.teslacar.climateControl.insideTemp,
            tempOutside: this.tempUnit === 'F' ? Math.round(this.teslacar.climateControl.outsideTemp * 9/5 + 32) : this.teslacar.climateControl.outsideTemp,
            tempUnit: this.tempUnit.toUpperCase(),
            carState: this.teslacar.carState,
            notes: this.teslacar.notes,
            version: this.softwareCurrentStatusName
        
        }
      })
        .then(() => this.platform.log.debug('The image was created successfully!'))
    });
  }
}
