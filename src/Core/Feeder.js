const bus = require("../event-bus");
const Gpio = require("pigpio").Gpio;
const terminate = require("pigpio").terminate;
const mqtt = require("../Core/MQTT");
const config = require("../config");
const database = require("../database");
const sleep = require('sleepjs').sleep;

const Library = require("./Library");

class Feeder extends Library {
  constructor(database) {
    super();
    this.database = database;
    this.gpios = {};
  }

  async run() {
    this.logger.info("Starting up.");
    this.feedFunc = (...args) => this.feed(...args);
    bus.on("feed", this.feedFunc);
  }

  async feed(feedData) {
    let isPaused = parseInt(await config.getConfigEntry("general", "paused"));
    if (isPaused) {
      this.logger.warning("Avoiding a feed because we are paused.");
      return;
    }

    var feedSuccessful = false;

    this.logger.info("Attempting a feed.");

    try {
      let Servo = this.database.modelFactory("Servo");
      let servo = await Servo.findOne({
        where: {
          pin: feedData.pin
        }
      });

      if (!servo) {
        this.logger.warn("Sent a feed for a pin we couldn't find?");
        return;
      }

      if (!this.gpios[feedData.pin]) {
        this.gpios[feedData.pin] = new Gpio(feedData.pin, {
          mode: Gpio.OUTPUT,
        });
      }

      let gpio = this.gpios[feedData.pin];

      servo.startSpin(gpio);
      await sleep(feedData.time * feedData.size * 1000);
      servo.stopSpin(gpio);

      feedSuccessful = true;
    } catch (error) {
      this.logger.error("Could not enable GPIO.");
      this.logger.error(error);
    }

    if (feedSuccessful) {
      this.logger.info("Feed successfully executed.");
      mqtt.publish(feedData.size);
    } else {
      this.logger.warn("Feed was unsuccessful.");
    }

    var feedName = feedData.name || "Received";
    if (feedData.feed) {
      var feed = feedData.feed;
      feed.feed_count++;
      feed.last_feed = new Date();
      feed.save();

      feedName = feed.name;
    }

    let FeedEvent = this.database.modelFactory("FeedEvent");
    if (feedData.onDemand) {
      feedName += " (On Demand)";
    }

    if (!feedSuccessful) {
      feedName += " (Unsuccessful)";
    }

    let f = await FeedEvent.create({
      name: feedName,
      size: feedData.size,
    });

    if (feedSuccessful) {
      bus.emit("feed.completed", f);
    } else {
      bus.emit("feed.failed", f);
    }
  }

  async shutdown() {
    this.logger.info("Shutting down.");
    try {
      terminate();
    } catch (error) {
      this.logger.error("Could not terminate GPIO.");
      this.logger.error(error);
    }

    bus.on("off", this.feedFunc);
  }
}

module.exports = new Feeder(database);
