function ok(res, data = null) {
  return res.json({ success: true, data });
}

function fail(res, statusCode, errorCode, message) {
  return res.status(statusCode).json({
    success: false,
    errorCode,
    message,
  });
}

module.exports = { ok, fail };
