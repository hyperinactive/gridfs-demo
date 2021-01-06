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
conn.once("open", () => {
	// init the grid stream
	gfs = GridFSStream(conn.db, mongoose.mongo);
	// specify the collection name
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
	res.status(200).render("index");
});

app.post("/uploads", upload.single("file"), (req, res) => {
	res.json({ file: req.file });
});

module.exports = app;
