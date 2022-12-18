/* Dashobard utils */

export class DashboardUtils {
  upArrow: string;
  downArrow: string;
  oneRing: string;
  twoRing: string;
  threeRing: string;
  teslaRed: string;
  teslaGrey: string;
  clock: string;
  cable: string;

  dashInfo: {
    battery: string;
    climate: string;
    range: string;
    carState: string;
    version: string;

  }

  constructor() {

    this.upArrow = '↑';
    this.downArrow = '↓';
    this.oneRing = '①';
    this.twoRing = '②';
    this.threeRing = '③';
    this.teslaRed = '#E31937';
    this.teslaGrey = '#717074';
    // Init ascii clock
    this.clock = '&#9202;';
    this.cable = '&#8623;';

    // Initialize dashboard info
    this.dashInfo = {
      battery: '',
      climate: '',
      range: '',
      carState: '',
      version: '2003.7.1',
    };
  }

  // Return string wrappen in tspan tags
  colorize(text: string, color: string): string {
    return `<tspan style="fill:${color}">${text}</tspan>`;
  }

  tempDisplay(temp: number, tempUnit: string): string {
    if (tempUnit === 'C') {
      return Math.round(temp) + '°C';
    } else {
      return Math.round((temp * 9) / 5 + 32).toString() + '°F';
    }
  }
}
