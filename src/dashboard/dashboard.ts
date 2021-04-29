import { TeslafiPlatform } from '../platform/platform';
import { TeslaCar } from '../utils/teslaCar';
import nodeHtmlToImage from 'node-html-to-image';
import * as fs from 'fs';
import * as path from 'path';
import { getHeapStatistics } from 'node:v8';

export class Dashboard {
  private rangeUnit: string;
  private tempUnit: string;
  private softwareCurrentStatusName = '2003.7.1';
  private dashboardImageFilePath = '';

  constructor(
    protected readonly platform: TeslafiPlatform,
    protected teslacar: TeslaCar
  ) {
    const buffer = fs.readFileSync(path.join(__dirname, 'template.html'));
    const htmlTemplate = buffer.toString('utf8');
    this.dashboardImageFilePath = this.platform.config[
      'dashboardImageFilePath'
    ];
    if (!this.dashboardImageFilePath.endsWith('/')) {
      this.dashboardImageFilePath = this.dashboardImageFilePath + '/';
    }

    this.platform.log.info(
      'INIT dashboard to file path: ' +
        this.dashboardImageFilePath +
        ' - Use this path with homebridge-camera-ffmpeg to show.'
    );

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

      let notes = this.teslacar.notes;
      // Add the location if present. Sometimes TeslaFi includes that in the notes already, so check for that
      if (
        this.teslacar.location &&
        notes.indexOf(this.teslacar.location) === -1
      ) {
        notes = notes + ' @\u200A' + this.teslacar.location;
      }

      let chargingInfo = '';

      if(this.teslacar.battery.charging) {
        // If the car is charging, show the charging information
        switch (this.teslacar.battery.chargingPhases) {
          case 1:
            chargingInfo += ' \uD83D\uDD0B \u2780';
            break;
          case 2:
            chargingInfo += ' \uD83D\uDD0B \u2781';
            break;
          case 2:
            chargingInfo += ' \uD83D\uDD0B \u2782';
            break;
          default:
            chargingInfo += ' \uD83D\uDD0B';
            break;
        }
        chargingInfo += this.teslacar.battery.chargingAmpere + 'A ' + this.teslacar.battery.chargingVoltage + 'V ';
        chargingInfo += '+' + this.teslacar.battery.chargingAddedEnergy + '\u200AkWh +' + this.teslacar.battery.chargingAddedRange + '\u200A' + this.rangeUnit;
        chargingInfo += ' \u23F1' + this.teslacar.battery.chargingTimeToFull;
      } else {
        chargingInfo += this.teslacar.battery.chargingState;
      }

      let batteryLevel = this.teslacar.battery.level.toString();
      if(this.teslacar.battery.level > this.teslacar.battery.usableLevel) {
        batteryLevel += '\u200A(\u2744' + this.teslacar.battery.usableLevel +')';
      }
      batteryLevel += '\u200A/\u200A' + this.teslacar.battery.chargeLimit + '\u200A%';
 
      nodeHtmlToImage({
        output:
          this.dashboardImageFilePath +
          this.platform.config.name +
          '_dashboard.png',
        html: htmlTemplate,
        puppeteerArgs: { args: ['--no-sandbox'] },
        content: {
          batteryLevel: batteryLevel,
          range: this.teslacar.battery.range,
          rangeEstimated: this.teslacar.battery.estimatedRange,
          rangeUnit: this.rangeUnit.toLowerCase(),
          tempInside:
            this.tempUnit === 'F'
              ? Math.round(
                  (this.teslacar.climateControl.insideTemp * 9) / 5 + 32
                )
              : this.teslacar.climateControl.insideTemp,
          tempOutside:
            this.tempUnit === 'F'
              ? Math.round(
                  (this.teslacar.climateControl.outsideTemp * 9) / 5 + 32
                )
              : this.teslacar.climateControl.outsideTemp,
          tempUnit: this.tempUnit.toUpperCase(),
          carState: this.teslacar.carState,
          notes: notes,
          version: this.softwareCurrentStatusName,
          chargingInfo: chargingInfo,
        },
      }).then(() =>
        this.platform.log.debug('The image was created successfully!')
      );
    });
  }
}
