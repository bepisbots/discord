var utils = require("../app/utils");

describe("utils.removeUrls", function () {
  it("Single URL", function () {
    const MESSAGE = "https://cdn.discordapp.com/fetched.png :dizzy: Fluffbutt, God Of Fetches";
    var title = utils.removeUrls(MESSAGE);
    expect(title).toEqual(":dizzy: Fluffbutt, God Of Fetches");
  });
  it("Two URLs", function () {
    const MESSAGE = "https://cdn.discordapp.com/fetched.png :dizzy: Fluffbutt, God Of Fetches https://cdn.discordapp.com/fetched.png";
    var title = utils.removeUrls(MESSAGE);
    expect(title).toEqual(":dizzy: Fluffbutt, God Of Fetches");
  });
  it("Multiple URLs", function () {
    const MESSAGE = "https://cdn.discordapp.com/fetched.png :dizzy: Fluffbutt,https://cdn.discordapp.com/fetched.png God Of Fetches https://cdn.discordapp.com/fetched.png";
    var title = utils.removeUrls(MESSAGE);
    expect(title).toEqual(":dizzy: Fluffbutt, God Of Fetches");
  });
  it("Https & http", function () {
    const MESSAGE = "http://cdn.discordapp.com/fetched.png :dizzy: Fluffbutt, God Of Fetches https://cdn.discordapp.com/fetched.png";
    var title = utils.removeUrls(MESSAGE);
    expect(title).toEqual(":dizzy: Fluffbutt, God Of Fetches");
  });
}); 