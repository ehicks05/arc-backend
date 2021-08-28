const morgan = require("morgan");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./apollo");
const jwt = require("express-jwt");
const { createApolloServer } = require("./apollo");
const { scheduleUpdateScoresProcedure } = require("./tasks");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const app = express();
app.use(cors({ origin: ["https://arc.ehicks.net", "http://localhost:3000"] }));

// AUTH
const checkJwt = jwt({
  secret: process.env.SUPABASE_JWT_SECRET,
  credentialsRequired: false,
  audience: "authenticated",
  algorithms: ["HS256"],
});

app.use(morgan("dev"));
// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
// parse application/json
app.use(express.json());
// completely disable cache
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/", (req, res) => {
  res.send("See you at the party Richter!");
});
app.get("/test", checkJwt, async (req, res) => {
  const user = req.user;
  if (!user) {
    res.send("not authenticated");
    return;
  }

  res.send("authenticated");
});

app.get("/me", checkJwt, async (req, res) => {
  const authUser = await prisma.$executeRaw(
    `select * from auth.users where id = ${req?.user.id};`
  );
  res.json({
    message: "Hello! This is an authenticated route.",
    user: req.user,
    authUser,
  });
});

app.use(checkJwt, async (req, res, next) => {
  const username = req.user?.app_metadata?.username;
  if (username) {
    const user = await prisma.user.findUnique({ where: { id: username } });
    if (!user) {
      console.log(req.user);
      console.log(
        `incoming user ${username} is missing from public.users. creating...`
      );
      await prisma.user.create({ data: { id: username } });
    }
  }
  next();
});

app.use("/graphql", checkJwt);

const port = process.env.NODE_ENV === "production" ? process.env.PORT : 4000;
console.log(`process.env.NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`process.env.PORT: ${process.env.PORT}`);

const db_url = process.env.DATABASE_URL;
console.log(`DB: ${db_url.slice(db_url.indexOf("@") + 1)}`);

async function startApolloServer() {
  const apolloServer = createApolloServer();
  await apolloServer.start();
  apolloServer.applyMiddleware({ app });
  await new Promise((resolve) => app.listen({ port }, resolve));
  console.log(
    `🚀 Server ready at http://localhost:${port}${apolloServer.graphqlPath}`
  );

  scheduleUpdateScoresProcedure();
}

startApolloServer();
