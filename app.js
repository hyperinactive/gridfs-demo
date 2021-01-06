const express = require("express");
const path = require("path");
const ctypo = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const GridFSStorage = require("multer-gridfs-storage");
const GridFSStream = require("gridfs-stream");
const methodOverride = require("method-override");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const crypto = require("crypto");

// Init express
dotenv.config();
const app = new express();

// Middleware
app.use(bodyParser.json());
// for delete requests
app.use(methodOverride("_method"));
app.set("view engine", "ejs");

// DB
// if mongoose.connect(URI, configObject) isn't being used like here
// before making the connection we can set mongoose with set method and pass the params there
// neat stuff
// https://stackoverflow.com/questions/40818016/connect-vs-createconnection GOAT
mongoose.set("useNewUrlParser", true);
mongoose.set("useCreateIndex", true);
mongoose.set("useUnifiedTopology", true);

const mongoURI = process.env.DB_URI;
const conn = mongoose.createConnection(mongoURI);

// Init GFS
let gfs;

// deprecation warning
let gridFSBucket;

conn.once("open", () => {
  // init the grid stream
  gfs = GridFSStream(conn.db, mongoose.mongo);
  // specify the collection name
  gridFSBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads",
  });

  gfs.collection("uploads"); // uploads.chunks and uploads.files
});

// create storage engine
const storage = new GridFSStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
        };
        resolve(fileInfo);
      });
    });
  },
});

const upload = multer({ storage });

app.get("/", (req, res) => {
  // load all the images
  gfs.files.find({}).toArray((err, files) => {
    if (!files || files.length === 0) {
      return res.render("index", { files: false });
    } else {
      files.map((file) => {
        if (
          file.contentType === "image/jpeg" ||
          file.contentType === "image/png" ||
          file.contentType === "image/jpg"
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.status(200).render("index", { files: files });
    }
  });
});

app.post("/uploads", upload.single("file"), (req, res) => {
  res.json({ file: req.file });
});

app.get("/files", (req, res) => {
  // using gridfs stream here
  // same as the model.find in mongoose
  gfs.files.find().toArray((err, files) => {
    // check if files exist
    if (!files || files.length === 0) {
      return res.status(404).json({ err: "No files found" });
    }
    res.status(200).json(files);
  });
});

// find a single file
// DOESN'T FIND SHIT WHEN SEARCHING BY ID???
app.get("/files/:fileID", (req, res) => {
  // using gridfs stream here
  // same as the model.find in mongoose
  gfs.files.findOne(
    { _id: mongoose.Types.ObjectId(req.params.fileID) },
    (err, file) => {
      if (!file || file.length === 0) {
        return res.status(404).json({ err: "No file found" });
      }
      res.status(200).json(file);
    },
  );
});

// read the output of the image
app.get("/image/:fileID", (req, res) => {
  // using gridfs stream here
  // same as the model.find in mongoose
  gfs.files.findOne(
    { _id: mongoose.Types.ObjectId(req.params.fileID) },
    (err, file) => {
      if (!file || file.length === 0) {
        return res.status(404).json({ err: "No file found" });
      }

      if (
        file.contentType === "image/jpeg" ||
        file.contentType === "image/jpg" ||
        file.contentType === "image/png"
      ) {
        // old decprecated way
        // const readStream = gfs.createReadStream(file._id);

        // nice, new, modern way :) 
        const readStream = gridFSBucket.openDownloadStream(file._id);

        readStream.pipe(res);
      } else {
        res.status(404).json({ err: "Not an image" });
      }
    },
  );

  app.delete("/files/:fileID", (req, res) => {
    gfs.deleteOne(
      { _id: mongoose.Types.ObjectId(req.params.fileID), root: "uploads" },
      (err, file) => {
        if (err) {
          return res.status(404).json(err);
        }
        res.redirect("/");
      },
    );
  });
});

module.exports = app;
