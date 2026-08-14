// Work around uv_os_get_passwd failures seen in constrained Windows sessions.
const os = require('node:os');
try {
  os.userInfo();
} catch (_) {
  os.userInfo = () => ({
    username: process.env.USERNAME || 'builder',
    uid: -1,
    gid: -1,
    shell: null,
    homedir: process.env.USERPROFILE || process.cwd()
  });
}
