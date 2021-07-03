const express = require("express");
const router = express.Router();
const {
  getAllComments,
  getComment,
  createComment,
  softDeleteComment,
} = require("../services/comment_service");

router.get("/", async (req, res) => {
  res.send(await getAllComments());
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  res.send(await getComment(id));
});

router.post("/", async (req, res) => {
  const data = req.body;
  res.send(await createComment(data));
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  res.send(await softDeleteComment(id));
});

module.exports = router;
