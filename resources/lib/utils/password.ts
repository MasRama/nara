export function password_generator(pLength: number): string {
  const keyListAlpha = "abcdefghijklmnopqrstuvwxyz";
  const keyListInt = "123456789";
  const keyListSpec = "!@#_";
  let password = '';
  let len = Math.ceil(pLength / 2);
  len = len - 1;
  const lenSpec = pLength - 2 * len;

  for (let i = 0; i < len; i++) {
    password += keyListAlpha.charAt(Math.floor(Math.random() * keyListAlpha.length));
    password += keyListInt.charAt(Math.floor(Math.random() * keyListInt.length));
  }

  for (let i = 0; i < lenSpec; i++) {
    password += keyListSpec.charAt(Math.floor(Math.random() * keyListSpec.length));
  }

  password = password.split('').sort(() => 0.5 - Math.random()).join('');

  return password;
}
