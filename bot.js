import { Client, GatewayDispatchEvents, ActivityType } from "discord.js";
import { Riffy } from "riffy";
import dotenv from "dotenv";
import config from "./config.js";

dotenv.config();

export const client = new Client({
  intents: [
    "Guilds",
    "GuildMessages",
    "GuildVoiceStates",
    "GuildMessageReactions",
    "MessageContent",
    "DirectMessages",
  ],
});

client.riffy = new Riffy(client, config.lavalink.nodes, {
  send: (payload) => {
    const guild = client.guilds.cache.get(payload.d.guild_id);
    if (guild) guild.shard.send(payload);
  },
  defaultSearchPlatform: config.lavalink.defaultSearchPlatform,
  restVersion: config.lavalink.restVersion,
});


let currentActivityIndex = 0;
let activityInterval;
let currentlyPlaying = null;


function setRotatingActivity() {
  if (currentlyPlaying) {
    client.user.setActivity(`${currentlyPlaying.title} by ${currentlyPlaying.author}`, {
      type: ActivityType.Listening
    });
  } else {
    const activity = config.activities[currentActivityIndex];
    const activityType = ActivityType[activity.type] || ActivityType.Playing;
    
    client.user.setActivity(activity.text, { type: activityType });
    
    currentActivityIndex = (currentActivityIndex + 1) % config.activities.length;
  }
}

client.on("ready", () => {
  client.riffy.init(client.user.id);
  console.log(`Logado no client ${client.user.tag}`);
  

  setRotatingActivity();
  activityInterval = setInterval(setRotatingActivity, config.activityRotationInterval);
});

client.riffy.on("nodeConnect", (node) => {
  console.log(`Node "${node.name}" connected.`);
});

client.riffy.on("nodeError", (node, error) => {
  console.log(`Node "${node.name}" encountered an error: ${error.message}.`);
});

client.riffy.on("trackStart", async (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`Tocando agora: \`${track.info.title}\` by \`${track.info.author}\`.`);
  
  currentlyPlaying = {
    title: track.info.title,
    author: track.info.author
  };
  
  setRotatingActivity();
});

client.riffy.on("queueEnd", async (player) => {
  if (player.textChannel) {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send("Finalizado.");
  }
  
  currentlyPlaying = null;
  
  setRotatingActivity();
  
  player.destroy();
});

client.riffy.on("trackEnd", async (player, track) => {
  if (player.queue.length === 0) {
    currentlyPlaying = null;
    setRotatingActivity();
  }
});

client.on("raw", (d) => {
  if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
  client.riffy.updateVoiceState(d);
});


process.on('SIGINT', () => {
  if (activityInterval) {
    clearInterval(activityInterval);
  }
  client.destroy();
  process.exit(0);
});

client.login(process.env.TOKEN || config.token);