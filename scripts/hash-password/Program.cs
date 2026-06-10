using Microsoft.AspNetCore.Identity;
var hasher = new PasswordHasher<object>();
Console.WriteLine(hasher.HashPassword(null!, args.Length > 0 ? args[0] : "Test@123456"));
