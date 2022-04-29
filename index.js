const express = require("express");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const Joi = require("joi");

if (!("AUTH_PASSWORD" in process.env)) {
  console.log("Environment Variables not configured");
  process.exit(2);
}
authPassword = process.env.AUTH_PASSWORD;
emailAuth = {
  user: process.env.EMAIL_AUTH_USER,
  pass: process.env.EMAIL_AUTH_PWD,
};
host_name = process.env.HOST_NAME;
port = process.env.PORT;

initializeApp({
  credential: cert(JSON.parse(process.env.GOOGLE_CREDENTIALS)),
});
const app = express();
var transporter = nodemailer.createTransport({
  service: "Yandex",
  auth: emailAuth,
});

const send_email_schema = Joi.object({
  name: Joi.string().required(),
  secret: Joi.string().required(),
  email: Joi.string().email().required(),
});

app.use(express.urlencoded({ extended: true }));

app.get("/", (request, response) => {
  response.sendFile("index.html", { root: "public" });
});

app.post("/send_email", async (request, response) => {
  const headerToken = request.headers.authorization;
  if (headerToken != authPassword)
    return response.send({ message: "Invalid Auth Token" }).status(401);
  schema_check = send_email_schema.validate(request.body);
  if ("error" in schema_check)
    return response.send({ message: schema_check.error }).status(401);

  email_link = `${host_name}/verify/?token=${request.body.secret}`;

  mailOptions = {
    from: "vms.sfte@yandex.com",
    to: request.body.email,
    subject: `${request.body.name} wants to visit you at IIITA`,
    text: `<div style="width:99%">
      <h1 style="color:cyan;font-weight:bold;text-align:center">Visitor Management System</h1>
      <p>${request.body.name} wants to visit you in IIITA campus. To verify their visitor pass click the link below:- </p>
    <p> <a html="${email_link}">Verify!</a> </p>
    <p> You can also copy and paste this in browser:-  ${email_link}</p>
    </div>`,
  };

  success = await new Promise((resolve) => {
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });

  if (success) return response.sendStatus(200);
  return response.send({ message: "Server Error" }).status(501);
});

const firestore = getFirestore();
const passes = firestore.collection("passes");
app.get("/verify", (request, response) => {
  token = request.query["token"];

  passes
    .where(FieldPath.documentId(), "==", token)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty()) throw "Invalid token";
      querySnapshot.forEach((documentSnapshot) => {
        documentSnapshot.ref.set({ isVerified: true, isActive: true });
      });
    })
    .then((res) => {
      response.sendFile("success.html", { root: "public" });
    })
    .catch((res) => {
      response.sendFile("failiure.html", { root: "public" });
    });
});

app.listen(port, () => console.log(`The server is running at PORT ${port}`));
