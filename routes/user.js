const express = require("express");
const router = express.Router();
const User = require("../modules/User");
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const cloudinary = require("cloudinary").v2;
const convertToBase64 = require("../utils/convertToBase64");
const fileUpload = require("express-fileupload");

//route pour s'inscrire
router.post("/user/signup", fileUpload(), async (req, res) => {
  try {
    const { email, password, newsletter, username } = req.body;
    //si l'username n'est pas renseigné
    if (!username) {
      return res
        .status(404)
        .json({ message: "Veuillez renseigner un nom d'utilisateur" });
    }
    //si l'email n'est pas renseigné
    if (!email) {
      return res.status(404).json({ message: "Veuillez renseigner un email" });
    }
    const userFind = await User.findOne({ email });
    //si l'email existe déjà en BDD
    if (userFind) {
      return res.status(409).json({ message: "L'email renseigné existe déjà" });
    }
    if (!password) {
      return res
        .status(404)
        .json({ message: "Veuillez renseigner un mot de passe" });
    }
    //Pour tous les autres cas
    // Création du token et du mot de passe crypté
    const salt = uid2(16);
    const hash = SHA256(password + salt).toString(encBase64);
    const token = uid2(64);
    // Création du user sans l'avatar
    const userNew = new User({
      email,
      account: { username },
      newsletter,
      token: token,
      hash: hash,
      salt: salt,
    });

    //Création de l'avatar s'il existe
    if (req.files) {
      const profilPictureBas64 = convertToBase64(req.files.avatar);
      const profilPictureCloudinary = await cloudinary.uploader.upload(
        profilPictureBas64,
        { folder: `vinted/profils/${userNew._id}` }
      );
      userNew.account.avatar = {
        secure_url: profilPictureCloudinary.secure_url,
        public_id: profilPictureCloudinary.public_id,
      };
    }

    userNew.save();

    //réponse au client
    res.status(201).json({
      _id: userNew._id,
      token,
      account: {
        username,
        avatar: userNew.account.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//route pour se connecter
router.post("/user/login", async (req, res) => {
  try {
    const userFind = await User.findOne({ email: req.body.email });
    //Si l'email n'existe pas en BDD
    if (!userFind) {
      return res.status(401).json({ message: "Non authorisé" });
    }
    //Si le mot de passe ne correspond pas en BDD
    if (
      SHA256(req.body.password + userFind.salt).toString(encBase64) !==
      userFind.hash
    ) {
      return res.status(404).json({ message: "Non authorisé" });
    }
    //Pour tous les autres cas
    res.status(200).json({
      _id: userFind._id,
      token: userFind.token,
      account: { username: userFind.account.username },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
