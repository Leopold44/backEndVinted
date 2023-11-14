const User = require("../modules/User");

const isAuthenticated = async (req, res, next) => {
  if (req.headers.authorization) {
    const token = req.headers.authorization.replace("Bearer ", "");
    const user = await User.findOne({ token });
    if (!user) {
      return res.status(401).json({ message: "unauthorized" });
    } else {
      req.user = user;
      return next();
    }
  }
  return res.status(401).json({ message: "unauthorized" });
};

module.exports = isAuthenticated;
