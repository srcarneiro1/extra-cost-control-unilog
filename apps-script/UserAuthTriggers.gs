function handleUserPasswordEdit(e) {
  UserAuthService.handlePasswordEdit(e);
}

function installUserPasswordEditTrigger() {
  return UserAuthService.installEditTrigger();
}
