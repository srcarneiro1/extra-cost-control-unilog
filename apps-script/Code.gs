function doGet(e) {
  return Api.handleGet(e || {});
}

function doPost(e) {
  return Api.handlePost(e || {});
}
