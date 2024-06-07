const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://thread-nexus.web.app",
    "https://thread-nexus-client.vercel.app",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
// Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.talr0yk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const announcementCollection = client
      .db("nexusDB")
      .collection("announcements");
    const postsCollection = client.db("nexusDB").collection("posts");
    const usersCollection = client.db("nexusDB").collection("users");
    const commentsCollection = client.db("nexusDB").collection("comments");

    // Getting all posts
    app.get("/posts", async (req, res) => {
      // getting email query
      const email = req.query.email;
      let query = {};
      //   set query to email if email is present
      if (email) {
        query = { "author.email": email };
      }
      const posts = await postsCollection.find(query).toArray();
      res.send(posts);
    });

    // Add a new post
    app.post("/posts", async (req, res) => {
      const post = req.body;
      const result = await postsCollection.insertOne(post);
      res.send(result);
    });

    // Getting individual post details
    app.get("/post/:id", async (req, res) => {
      const id = req.params.id;
      const post = await postsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(post);
    });

    // Patching a post details and increase the comment count by 1
    app.patch("/post/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: {
          comments_count: 1,
        },
      };
      const result = await postsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Delete a post
    app.delete("/post/:id", async (req, res) => {
      const id = req.params.id;
      const result = await postsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Getting all comments
    app.get("/comments", async (req, res) => {
      const comments = await commentsCollection.find().toArray();
      res.send(comments);
    });

    // Getting comments of a post
    app.get("/comments/:postId", async (req, res) => {
      const postId = req.params.postId;
      const post = await commentsCollection
        .find({
          postId,
        })
        .toArray();
      res.send(post);
    });

    // Add a new comment
    app.post("/comments", async (req, res) => {
      const comment = req.body;
      const result = await commentsCollection.insertOne(comment);
      res.send(result);
    });

    // Getting all users
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // Getting individual user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({
        email,
      });
      res.send(user);
    });

    // Add a new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        res.send({ message: "User already exists" });
        return;
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Patch a user details
    app.patch("/user/:email", async (req, res) => {
      const email = req.params.email;
      const { membership_status } = req.body;
      const filter = { email };
      const updateDoc = {
        $set: {
          membership_status,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Announcements
    app.get("/announcements", async (req, res) => {
      const announcements = await announcementCollection.find().toArray();
      res.send(announcements);
    });

    // Add a new announcement
    app.post("/announcements", async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    });

    // Post Payment
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const ammount = parseInt(price * 100);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: ammount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
