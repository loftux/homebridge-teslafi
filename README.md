# Homebridge Teslafi

This plugin for Homebridge lets you view status and control your Tesla usin Homekit via the Teslafi API.  

---
**NOTE:**  
Before you go ahead and install this plugin, you must have an account at [Teslafi](https://about.teslafi.com), that is a service you have to pay to use. This plugin is however free, but as a thank you you can use this referral link to [sign up for Teslafi](https://www.teslafi.com/signup.php?referred=loftux).  
If you don't even own a Tesla yet, buy using this [referral link](https://ts.la/peter18116) to get free supercharger miles.

---

## Features

* **Online status:** Shows if your car is online or sleeping. Lets you wake your Tesla if it is sleeping.
* **Sentry Mode:** Turn Sentry mode On or Off.
* **Charger:** Start and Stop charging, track battery level. Configurable low battery warning level.
* **Charge Port:** Open and Close the charge port.
* **Climate Control:**  Start and Stop the Climate system. Set the temperature.
* **Door lock:** Unlock and lock doors.

State of each accessory is updated if changed outside of Homekit. For example, when Sentry Mode is activated, it will give you a notification in Homekit. Each accessory can be disabled if you do not intend to use it. 

![Screenshot](https://raw.githubusercontent.com/loftux/homebridge-teslafi/master/images/screenshot.PNG)

### Why use this plugin?
Each application or plugin that you have that polls data from you Tesla makes it harder for your car to sleep, and thus drain battery. Teslafi already manage this well, and by polling the Teslafi API instead of Tesla API directly, we do not interfere with sleep attempts.

It is also fast, Homekit is very sensitive to slow responses. This plugin polls data from Teslafi with a set intervall, and already has the data whe Homekit requests it. However, there will be a small delay to pick up external changes, for example when you start charging the car, it can take 1-2 minutes (depending on poll intervall) before your Homekit shows as Charging. Better than the dreadful 'No response'.

## Configuration
You must create and get your Teslafi API token. Login to your Teslafi account, select *Settings*, *Account* and *Advanced* at the bottom of the page. Then select *Teslafi API Access* link and create your token.  
**NOTE:** Teslafi API Token is NOT the same as a Tesla token and must be created separately.

On the Teslafi API page, enable or disable the API functions you intend to use. For example, if you plan to use the Climate Control, enable *Start HVAC*, *Stop HVAC*, *Set HVAC Temperature*. If not enabled in Teslafi, the changes sent via Homekit will be ignored.  

This plugin supports configuation using the [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x).

### Manual configuration

Coming: Explanation of each setting. If you do not have access to Homebridge Config UI, there are more details in config.schema.json.

    "platforms": [
        {
            "platform": "TeslafiPlugin",
            "name": "MyTesla",
            "token": "<Teslafi token>",
            "lowBatterylevel": 20,
            "teslafiRefreshTimeout": 60,
            "wakeupTimeout": 15,
            "tempUnit": "C",
            "rangeUnit": "km",
            "disableTeslaOnlineAccessory": false,
            "disableTeslaSentryAccessory": false,
            "disableTeslaBatteryAccessory": false,
            "disableTeslaThermostatAccessory": false,
            "disableTeslaChargePortAccessory": false,
            "disableTeslaDoorLockAccessory": false
        }
    ]
    

## Known issues and limitations
If you have your polling of Teslafi set to low (min 30s), then when you turn on for example Climate or Sentry mode, the control can switch back to previous mode (on/off). This is because Teslafi has not yet polled the car and has the updated data from the car. So after another minut or so, the Accessory will turn on/off again and show the setting you wanted. If this becomes a problem for you, increase the polling time, and Teslafi will have picked up the change before the plugin polls for the data.

Trunk/Frunk. Teslafi API does not allow for unlocking the trunk or frunk. So there will be no Accessory for that for now.

## Coming features and ideas
This are things that I'm looking into implementing, and that is supported by the Teslafi API.

* Switch to Enable / Disable logging in Teslafi. This will most likely turn off getting the data needed for this plugin, so not sure how useful this would be.
* Start Polling - A switch let calls the Teslafi API to start polling. Can be used to let Teslafi that you now intend to use the car, and skip trying to sleep.
* Switch for max defrost.
* Be able to change charge level.
* Location Aware sensors - Teslafi returns when your car is in one of your user defined locations. This can be used to trigger a Homekit sensor, and then used for automation.
* Sensor for new version available. Then use Automation to turn all you light bulbs on 100% so that you don't miss installing right away!
* Sensor for  "is_user_present": "1"
* Sensor for Driving.