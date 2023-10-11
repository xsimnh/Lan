// ==UserScript==
// @name         Lan
// @version      0.1
// @description  download a file contains all file direct download urls in a folder share url
// @author       xsimnh
// @match        https://*.lanzouw.com/*
// @match        https://*.lanzoui.com/*
// @match        https://*.lanzoux.com/*
// ==/UserScript==

const shareUrl = "",
  password = "";
const origin = new URL(shareUrl).origin;

function formatHtmlText(html) {
  // escape character \x3C to <
  html = html.replace(/\\x3C/g, "<");
  // remove js and html comments(// and <!-- -->)
  html = html.replace(/<!--.+?-->|\s+\/\/\s*.+/g, ""); // remove html comments
  html = html.replace(/(.+?[,;])\s*\/\/.+/g, "$1"); // remove js comments
  return html;
}
const http = {
  _convertUrl: function (url) {
    if (url.startsWith("https") || url.startsWith("http")) {
      return url;
    }
    if (!url.startsWith("/")) {
      url += "/";
    }
    return origin + url;
  },
  get: function (url) {
    url = this._convertUrl(url);
    return fetch(url);
  },
  post: function (url, data) {
    url = this._convertUrl(url);
    return fetch(url, {
      method: "post",
      body: new URLSearchParams(data).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });
  }
};
function getFileUrls(lx, pg, k, t, fid, pwd, urls = []) {
  return http
    .post("/filemoreajax.php", { lx, pg, k, t, fid, pwd })
    .then((response) => response.json())
    .then((data) => {
      switch (data.zt) {
        case 1:
          const fileUrls = data.text.map((d) => origin + (d.t == 1 ? "" : "/") + d.id);
          urls = urls.concat(fileUrls);
          // only return the first 50 files
          if (fileUrls.length == 50) {
            return getFileUrls(lx, pg + 1, k, t, fid, pwd, urls);
          }
          return urls;
        case 2:
          // already get all files info
          return urls;
        default:
          break;
      }
    });
}
function getDirectUrlByFileUrl(url) {
  return http
    .get(url)
    .then((response) => response.text())
    .then((html) => {
      html = formatHtmlText(html);
      const iframeSrc = html.match(/<iframe.*?src="(.+?)"/)[1];
      return http.get(iframeSrc);
    })
    .then((response) => response.text())
    .then((html) => {
      html = formatHtmlText(html);
      const sign = html.match(/'sign':(.+?),/)[1];
      return http.post("/ajaxm.php", { action: "downprocess", sign, ves: 1 });
    })
    .then((response) => response.json())
    .then((data) => {
      if (data.zt == "1") {
        return data.dom + "/file" + data.url;
      }
      return null;
    });
}
function getFolderFilesDirectUrls(url) {
  return http
    .get(url)
    .then((response) => response.text())
    .then((html) => {
      html = formatHtmlText(html);
      const lx = html.match(/'lx':'?(\d)'?,/)[1],
        __t = html.match(/'t':'?((.){6})'?,/)[1],
        __k = html.match(/'k':'?((.){6})'?,/)[1],
        t = html.match(new RegExp(`var ${__t} = '(\\d{10})';`))[1],
        k = html.match(new RegExp(`var ${__k} = '([0-9a-z]{15,})';`))[1],
        fid = html.match(/'fid':'?(\d+)'?,/)[1];
      return getFileUrls(lx, 1, k, t, fid, password);
    })
    .then((urls) => Promise.all(urls.map((url) => getDirectUrlByFileUrl(url))).then((data) => data.filter((d) => !!d)));
}
function downloadFolderFilesDirectUrls(url) {
  getFolderFilesDirectUrls(url).then((urls) => {
    const file = new File([urls.join("\n")], "list.txt", {
      type: "text/plain"
    });
    const aTag = document.createElement("a");
    aTag.href = URL.createObjectURL(file);
    aTag.download = file.name;
    aTag.click();
    URL.revokeObjectURL(aTag.href);
  });
}
downloadFolderFilesDirectUrls(shareUrl);
