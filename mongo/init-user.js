const appDb = process.env.MONGO_APP_DB || "quizcraft";
const appUser = process.env.MONGO_APP_USER;
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appUser || !appPassword) {
  throw new Error("MONGO_APP_USER and MONGO_APP_PASSWORD are required.");
}

const targetDb = db.getSiblingDB(appDb);
const existingUser = targetDb.getUser(appUser);

if (!existingUser) {
  targetDb.createUser({
    user: appUser,
    pwd: appPassword,
    roles: [{ role: "readWrite", db: appDb }],
  });
  print(`Created MongoDB app user "${appUser}" for db "${appDb}".`);
} else {
  print(`MongoDB app user "${appUser}" already exists.`);
}

