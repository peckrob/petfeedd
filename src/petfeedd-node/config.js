const commandLineArgs = require("command-line-args");
const fs = require("fs");
const ini = require("ini");

class Config {
  // Define a default config.
  config = {
    logging: {
      logging_enabled: 1,
      logging_method: "stdout",
    },

    general: {
      database: "petfeedd.db",
      name: "petfeedd",
    },

    discovery: {
      enabled: 1,
    },

    web: {
      enabled: 1,
      bind_address: "0.0.0.0",
      bind_port: 8080,
    },

    gpio: {
      servo_pin: 17,
      servo_feed_time: 0.25,
    },

    logging: {
      enabled: 1,
      method: "stdout",
    },
  };

  loadConfig() {
    // Parse any command line args.
    const args = commandLineArgs([{ name: "config", alias: "c", type: String }]);

    // Try to load from the environment.
    for (const [key, value] of Object.entries(process.env)) {
      if (key.substr(0, 9) == "petfeedd") {
        var keys = key.split("_", 2);
        keys.shift();
        config[keys[0]][keys[1]] = value;
      }
    }

    // Try to load from config.
    var config_loaded = false;
    if (args.config) {
      if (fs.existsSync(args.config)) {
        this.config = ini.parse(fs.readFileSync(args.config, "utf-8"));
        config_loaded = true;
      }

      // If we weren't given a config, check for some common locations on *NIX
      // systems.
    } else {
      var commonLocations = [
        "./petfeedd.conf",
        "/etc/petfeedd.conf",
        "/usr/local/etc/petfeedd.conf",
      ];

      for (const i in commonLocations) {
        if (commonLocations.hasOwnProperty(i)) {
          const location = commonLocations[i];
          if (fs.existsSync(location)) {
            console.log("Config file found at " + location);
            console.log("Parsing configuration.");
            this.config = ini.parse(fs.readFileSync(location, "utf-8"));
            config_loaded = true;
            break;
          }
        }
      }
    }

    // Warn if we don't have a config file.
    if (!config_loaded) {
      console.log(
        "No config file specified. Proceeding with defaults and environment."
      );
    }
  }

  getConfig() {
    return this.config;
  }
}

module.exports = new Config();
