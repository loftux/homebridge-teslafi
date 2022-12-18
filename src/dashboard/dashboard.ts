import { TeslafiPlatform } from '../platform/platform';
import { TeslaCar } from '../utils/teslaCar';
import sharp from 'sharp';
import template from './template.svg';
import { DashboardUtils } from './dashboardUtils';
import * as fs from 'fs';
import * as path from 'path';

export class Dashboard {
  private rangeUnit: string;
  private tempUnit: string;
  private dashboardImageFilePath = '';
  private dashboardUtils = new DashboardUtils();

  constructor(
    protected readonly platform: TeslafiPlatform,
    protected teslacar: TeslaCar
  ) {
    this.dashboardImageFilePath =
      this.platform.config['dashboardImageFilePath'];
    if (!this.dashboardImageFilePath.endsWith('/')) {
      this.dashboardImageFilePath = this.dashboardImageFilePath + '/';
    }

    this.platform.log.info(
      'INIT dashboard to file path: ' +
      this.dashboardImageFilePath + this.platform.config.name + '_dashboard.png' +
      ' - Use this path with homebridge-camera-ffmpeg to show.'
    );

    this.rangeUnit = <string>this.platform.config['rangeUnit'];
    this.tempUnit = <string>this.teslacar.tempUnit

    this.teslacar.em.on('teslafifetch', async () => {
      if (this.teslacar.skipUpdate) {
        // This should only happen once, so reset the skip if something has gone wrong elsewheeere
        return;
      }

      // Update the used unit on new fetch
      this.tempUnit = <string>this.teslacar.tempUnit;

      switch (this.teslacar.software.status) {
        case 'downloading_wifi_wait':
          this.dashboardUtils.dashInfo.version =
            this.teslacar.software.current +
            ' - ' +
            this.dashboardUtils.colorize(this.teslacar.software.new, this.dashboardUtils.teslaRed) +
            ' Waiting for Wifi';
          break;
        case 'scheduled':
          this.dashboardUtils.dashInfo.version =
            this.teslacar.software.current +
            ' - ' +
            this.dashboardUtils.colorize(this.teslacar.software.new, this.dashboardUtils.teslaRed) +
            ' Scheduled to install';
          break;
        case 'downloading':
          this.dashboardUtils.dashInfo.version =
            this.teslacar.software.current +
            ' - ' +
            this.dashboardUtils.colorize(this.teslacar.software.new, this.dashboardUtils.teslaRed) +
            ' Downloading';
          break;
        case 'installing':
          this.dashboardUtils.dashInfo.version =
            this.teslacar.software.current +
            ' - ' +
            this.dashboardUtils.colorize(this.teslacar.software.new, this.dashboardUtils.teslaRed) +
            ' Installing';
          break;
        case 'available':
          this.dashboardUtils.dashInfo.version =
            this.teslacar.software.current +
            ' - ' +
            this.dashboardUtils.colorize(this.teslacar.software.new, this.dashboardUtils.teslaRed) +
            ' Available for install';
          break;
        default:
          this.dashboardUtils.dashInfo.version =
            this.dashboardUtils.colorize(this.teslacar.software.current, this.dashboardUtils.teslaGrey) + ' Installed';
      }

      let notes = this.teslacar.notes;
      if (notes) {
        // Add parenthesis for clearer display
        notes = '(' + notes + ')';
        // Remove no tagged location if found
        notes = notes.replace('No Tagged Location Found', '-');
      }
      // Add the location if present. Sometimes TeslaFi includes that in the notes already, so check for that
      if (
        this.teslacar.location &&
        notes.indexOf(this.teslacar.location) === -1 &&
        this.teslacar.location !== 'No Tagged Location Found'
      ) {
        notes = notes + this.dashboardUtils.colorize(' @ ', this.dashboardUtils.teslaGrey) + this.teslacar.location;
      }

      this.dashboardUtils.dashInfo.carState = this.teslacar.carState + notes;

      let chargingInfo = '';

      if (this.teslacar.battery.charging) {
        // If the car is charging, show the charging information
        // Add the calbe icon in green
        chargingInfo += this.dashboardUtils.colorize(this.dashboardUtils.cable, 'green');
        // Charging phases
        switch (this.teslacar.battery.chargingPhases) {
          case 1:
            chargingInfo += this.dashboardUtils.oneRing + '&#8198;';
            break;
          case 2:
            chargingInfo += this.dashboardUtils.twoRing + '&#8198;';
            break;
          case 3:
            chargingInfo += this.dashboardUtils.threeRing + '&#8198;';
            break;
          default:
            chargingInfo += '&#8198;';
            break;
        }
        chargingInfo +=
          this.teslacar.battery.chargingAmpere +
          'A ' +
          this.teslacar.battery.chargingVoltage +
          'V ';
        chargingInfo +=
          '+' +
          this.teslacar.battery.chargingAddedEnergy +
          '\u200AkWh +' +
          this.teslacar.battery.chargingAddedRange +
          '\u200A' +
          this.rangeUnit;
        chargingInfo += ' ' + this.dashboardUtils.colorize(this.dashboardUtils.clock, 'green') + this.teslacar.battery.chargingTimeToFull;
      } else {
        chargingInfo += ' ' + this.dashboardUtils.colorize(this.dashboardUtils.cable, this.dashboardUtils.teslaGrey) +
          ' ' + this.teslacar.battery.chargingState;
      }

      let batteryLevel = this.teslacar.battery.level.toString();
      // Show usable level, but not if charging due to space constraint
      if (
        this.teslacar.battery.level > this.teslacar.battery.usableLevel &&
        !this.teslacar.battery.charging
      ) {
        batteryLevel +=
          '\u200A(' + this.dashboardUtils.colorize('*', 'blue') + this.teslacar.battery.usableLevel + ')';
      }
      batteryLevel +=
        '\u200A/\u200A' + this.teslacar.battery.chargeLimit + '\u200A%';

      // If batterlevel is below config warning level, colorize it red
      if (this.teslacar.battery.level < this.platform.config.lowBatterylevel ||
        this.teslacar.battery.usableLevel < this.platform.config.lowBatterylevel) {

        batteryLevel = this.dashboardUtils.colorize(batteryLevel, this.dashboardUtils.teslaRed);
      }

      this.dashboardUtils.dashInfo.battery = batteryLevel + ' ' + chargingInfo;

      // Dwon arrow \u2b07\ufe0f, Up arrow  \u2b06\ufe0f Thermometer \ud83c\udf21\ufe0f
      let climateIcon = '';
      if (this.teslacar.climateControl.isClimateOn) {
        if (
          this.teslacar.climateControl.insideTemp <
          this.teslacar.climateControl.tempSetting
        ) {
          // We are heating
          climateIcon = '&#8198;' + this.dashboardUtils.colorize(this.dashboardUtils.upArrow, this.dashboardUtils.teslaRed) + '&#8198;';
        } else if (
          // We are cooling
          this.teslacar.climateControl.insideTemp >
          this.teslacar.climateControl.tempSetting
        ) {
          climateIcon = '&#8198;' + this.dashboardUtils.colorize(this.dashboardUtils.downArrow, 'blue') + '&#8198;';
        } else {
          // It is equal, check outside temp if we are heating or cooling
          if (
            this.teslacar.climateControl.tempSetting >
            this.teslacar.climateControl.outsideTemp
          ) {
            // tempSetting is higher than outside temp, we are heating
            climateIcon = '&#8198;' + this.dashboardUtils.colorize(this.dashboardUtils.upArrow, this.dashboardUtils.teslaRed) + '&#8198;';
          } else {
            // tempSetting is lower than outside temp, we are cooling
            climateIcon = '&#8198;' + this.dashboardUtils.colorize(this.dashboardUtils.downArrow, 'blue') + '&#8198;';
          }
        }
      }
      // {{tempInside}} &deg;{{tempUnit}} (Inside) {{tempOutside}} &deg;{{tempUnit}} (Outside) {{climateIcon}}

      this.dashboardUtils.dashInfo.climate = this.dashboardUtils.tempDisplay(this.teslacar.climateControl.insideTemp, this.tempUnit)
        + climateIcon + ' (Inside) ';
      // if ousideTemp is less than 0, colorize it blue
      if (this.teslacar.climateControl.outsideTemp < 0) {
        this.dashboardUtils.dashInfo.climate += this.dashboardUtils.colorize(this.dashboardUtils.tempDisplay(this.teslacar.climateControl.outsideTemp, this.tempUnit), 'blue') + ' (Outside)';
      } else {
        this.dashboardUtils.dashInfo.climate += this.dashboardUtils.tempDisplay(this.teslacar.climateControl.outsideTemp, this.tempUnit) + ' (Outside)';
      }
      // if climate is on, add &#8277; to the end
      if (this.teslacar.climateControl.isClimateOn) {
        this.dashboardUtils.dashInfo.climate += this.dashboardUtils.colorize(' &#8277; ', this.dashboardUtils.teslaGrey);
      }

      this.dashboardUtils.dashInfo.range = this.teslacar.battery.estimatedRange + '&#8198;' + this.rangeUnit.toLowerCase()
        + ' (Estimated) ' + this.teslacar.battery.range + '&#8198;' + this.rangeUnit.toLowerCase() + ' (Rated)';

      const imgSvg = Buffer.from(template({
        fontFamily: this.platform.config.fontFamily || '\'Helvetiva\', \'Gotham\', \'Arial\', \'DejaVu Sans\', \'Liberation Sans\'',
        battery: this.dashboardUtils.dashInfo.battery,
        range: this.dashboardUtils.dashInfo.range,
        climate: this.dashboardUtils.dashInfo.climate,
        carstate: this.dashboardUtils.dashInfo.carState,
        version: this.dashboardUtils.dashInfo.version,
      }).trim(), 'utf8');

      //this.platform.log.debug('SVG image: ' + imgSvg);

      const imgDashboard = await sharp(imgSvg, { format: 'svg' });

      await imgDashboard.toFile(this.dashboardImageFilePath + this.platform.config.name + '_dashboard.png');

    });
  }
}
