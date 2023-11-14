const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;

const fileUpload = require("express-fileupload");

const Offer = require("../modules/Offer");

const isAuthenticated = require("../middleware/isAuthenticated");
const convertToBase64 = require("../utils/convertToBase64");

//route pour créer une nouvelle offer
router.post(
  "/offers/publish",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      const { title, description, brand, size, color, condition, city, price } =
        req.body;

      //limiter le titre la description et le prix
      if (title.length > 50) {
        return res.status(400).json({
          message: "Vous devez saisir un titre inférieure à 50 caractères.",
        });
      }
      if (description.length > 500) {
        return res.status(400).json({
          message:
            "Vous devez saisir une description inférieure à 500 caractères.",
        });
      }
      if (typeof price !== "number") {
        return res
          .status(400)
          .json({ message: "Vous devez saisir un prix au format numérique." });
      }
      if (price > 100000) {
        return res.status(400).json({
          message: "Vous devez saisir un prix inférieure ou égal à 100 000 €.",
        });
      }
      //Création de la nouvelle offre
      const newOffer = new Offer({
        product_name: title,
        product_description: description,
        product_price: price,
        product_details: [
          { MARQUE: brand },
          { TAILLE: size },
          { ETAT: condition },
          { COULEUR: color },
          { EMPLACEMENT: city },
        ],
        owner: req.user._id,
      });
      //ajout de la photo de principale
      if (req.files.picture) {
        const pictureBase64 = convertToBase64(req.files.picture);
        const pictureCloudinary = await cloudinary.uploader.upload(
          pictureBase64,
          {
            folder: `vinted/offers/${newOffer._id}`,
          }
        );
        newOffer.product_image = {
          secure_url: pictureCloudinary.secure_url,
          public_id: pictureCloudinary.public_id,
        };
      }
      //ajout des photos secondaires
      if (req.files.product_pictures) {
        for (i = 0; i < req.files.product_pictures.length; i++) {
          const picturesBase64 = convertToBase64(req.files.product_pictures[i]);
          const picturesCloudinary = await cloudinary.uploader.upload(
            picturesBase64,
            {
              folder: `vinted/offers/${newOffer._id}`,
            }
          );
          newOffer.product_pictures.push({
            secure_url: picturesCloudinary.secure_url,
            public_id: picturesCloudinary.public_id,
          });
        }
      }
      //sauvegarde et renvoi au client
      console.log(newOffer);
      await newOffer.save();
      await newOffer.populate("owner", "account");
      res.status(201).json({ newOffer });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

//route pour modifier une offer
router.put("/offers/:id", isAuthenticated, fileUpload(), async (req, res) => {
  try {
    const modifyOffer = await Offer.findOne({ _id: req.params.id });
    //Modification des textes de l'offre
    const { title, description, price, condition, city, brand, size, color } =
      req.body;
    modifyOffer.product_name = title;
    modifyOffer.product_description = description;
    modifyOffer.product_price = price;
    modifyOffer.product_details[0].MARQUE = brand;
    modifyOffer.product_details[1].TAILLE = size;
    modifyOffer.product_details[2].ETAT = condition;
    modifyOffer.product_details[3].COULEUR = color;
    modifyOffer.product_details[4].EMPLACEMENT = city;
    //Suppression de la photo principale sur Cloudinary et ajout de la nouvelle
    await cloudinary.uploader.destroy(modifyOffer.product_image.public_id);
    const pictureModifiedBase64 = convertToBase64(req.files.picture);
    const pictureModifiedCloudinary = await cloudinary.uploader.upload(
      pictureModifiedBase64,
      { folder: `vinted/offers/${modifyOffer._id}` }
    );
    modifyOffer.product_image = {
      secure_url: pictureModifiedCloudinary.secure_url,
      public_id: pictureModifiedCloudinary.public_id,
    };
    //Suppression des photos secondaires sur Cloudinary et ajout des nouvelles

    for (i = 0; i < modifyOffer.product_pictures.length; i++) {
      await cloudinary.uploader.destroy(
        modifyOffer.product_pictures[i].public_id
      );
    }
    modifyOffer.product_pictures = [];
    for (i = 0; i < req.files.product_pictures.length; i++) {
      const picturesModifiedBase64 = convertToBase64(
        req.files.product_pictures[i]
      );
      const picturesModifiedCloudinary = await cloudinary.uploader.upload(
        picturesModifiedBase64,
        {
          folder: `vinted/offers/${modifyOffer._id}`,
        }
      );
      modifyOffer.product_pictures.push({
        secure_url: picturesModifiedCloudinary.secure_url,
        public_id: picturesModifiedCloudinary.public_id,
      });
    }

    await modifyOffer.save();
    res.status(200).json(modifyOffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//route pour supprimer une offre
router.delete("/offers/:id", isAuthenticated, async (req, res) => {
  try {
    const deleteOffer = await Offer.findByIdAndDelete(req.params.id);
    await cloudinary.uploader.destroy(deleteOffer.product_image.public_id);
    for (i = 0; i < deleteOffer.product_pictures.length; i++) {
      await cloudinary.uploader.destroy(
        deleteOffer.product_pictures[i].public_id
      );
    }
    res.status(200).json(deleteOffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//route de recherche des offres avec application de filtres et de tris
router.get(
  "/offers",
  /*isAuthenticated,*/ async (req, res) => {
    try {
      console.log(req.body);
      const { page, title, priceMax, priceMin, sort } = req.query;
      const nbreOfferByPage = 10;

      //valeur des query par défaut
      let pageNew = page;
      let titleNew = title;
      let priceMaxNew = priceMax;
      let priceMinNew = priceMin;
      let sortNew = sort;
      if (!page) {
        pageNew = 1;
      }
      if (!title) {
        titleNew = "";
      }
      if (!priceMax) {
        priceMaxNew = Infinity;
      }
      if (!priceMin) {
        priceMinNew = 0;
      }
      if (!sort) {
        sortNew = "price-desc";
      }

      //application des filtres et tris
      const regexp = new RegExp(titleNew, "i");
      const toSort = sortNew.split("-");
      if (toSort[0] === "price") {
        toSort[0] = "product_price";
      }
      const offerFind = await Offer.find({
        product_name: regexp,
        product_price: { $gte: priceMinNew, $lte: priceMaxNew },
      })
        .sort({ [toSort[0]]: toSort[1] })
        .skip((pageNew - 1) * nbreOfferByPage)
        .limit(nbreOfferByPage)
        .populate("owner", "account");

      return res.status(200).json(offerFind);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.get("/offers/:id", async (req, res) => {
  try {
    const offerId = await Offer.findById(req.params.id);
    await offerId.populate("owner", "account");
    res.status(200).json(offerId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
