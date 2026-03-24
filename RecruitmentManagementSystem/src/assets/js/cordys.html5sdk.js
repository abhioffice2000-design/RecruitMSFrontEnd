/*!
 * Cordys HTML5 SDK
 *
 * Copyright (c) 2013 Cordys
 */

(function () {
  window.showModalDialog =
    window.showModalDialog ||
    function (url, arg, opt) {
      opt = opt || 'dialogWidth:300px;dialogHeight:200px'; //options: dialogTop;dialogLeft;dialogWidth;dialogHeight or CSS styles
      var dialogTitle = 'Webpage Dialog';
      if (arg && arg.dialogTitle) {
        dialogTitle = arg.dialogTitle;
      }
      var dialog = document.body.appendChild(document.createElement('dialog')); //NOMBV
      $(dialog).attr('style', opt.replace(/dialog/gi, ''));
      var modal_wrapper = document.createElement('div');
      modal_wrapper.setAttribute('id', 'modal_wrapper');
      var titlebar = document.createElement('div');
      titlebar.setAttribute('id', 'titlebar');
      var container = document.createElement('div');
      container.setAttribute('id', 'container');
      modal_wrapper.appendChild(titlebar); //NOMBV
      modal_wrapper.appendChild(container); //NOMBV
      dialog.appendChild(modal_wrapper); //NOMBV
      titlebar.innerHTML =
        dialogTitle +
        ' <a href="#" id="dialog-close" style="font-size: 20px; color: #000; text-decoration: none; float: right; padding-right: 4px;">&times;</a>';
      $(titlebar).attr(
        'style',
        'background-color: #42afee; font-family: Tahoma,Geneva,sans-serif; padding: 5px;'
      );
      container.innerHTML =
        '<iframe id="dialog-body" src="' +
        url +
        '" style="border: 0"></iframe>';
      document.getElementById('dialog-body').contentWindow.dialogArguments =
        arg;
      document
        .getElementById('dialog-close')
        .addEventListener('click', function (e) {
          e.preventDefault();
          dialog.close();
        });
      dialog.showModal();
    };
})();

(function (window, $, undefined) {
  if (typeof jQuery == 'undefined') {
    throw new Error(
      'jQuery is required, please ensure it is loaded before this library'
    );
    //	document.write('<script src="/cordys/thirdparty/jquery/jquery.js"><\/script>');
  }
  if (!$.cordys)
    $.cordys = {
      cookiePath: '/cordys',
      baseUrlPath: '',
      isMobile: false,
      webDirectoryPath: null,
    };

  $.cordys.loadScript = function (url, callback, async, cache) {
    return $.ajax({
      type: 'GET',
      url: url,
      success: callback,
      dataType: 'script',
      async: async || false,
      cache: cache || true,
    });
  };

  // In BOP4.2 we need to set the base, as most urls are relative
  //var _baseTag =	document.getElementsByTagName("base")[0] ||
  //	document.getElementsByTagName("head")[0].appendChild(document.createElement("base"));
  //_baseTag.href = document.location.href.split('/').slice(0,(document.location.href.split('/')[3] == 'cordys' ? 4 : 5)).join('/') + '/';  // protocol://domain[:port]/virtualroot/organization/  or (compatible protocol://domain[:port]/cordys/

  if (!window.console) window.console = {};
  if (!window.console.log)
    window.console.log = window.console.error = function () { };

  $.cordys.getURLParameter = function (url, name) {
    var urlString = typeof url === 'object' ? url.search : url;
    return urlString.search(new RegExp('[?&]' + name + '=([^&]*)')) >= 0
      ? RegExp.$1
      : '';
  };

  $.cordys.addURLParameter = function (url, name, value) {
    if (!value) return url;

    var parSeparator = url.indexOf('?') < 0 ? '?' : '&';
    return url + parSeparator + name + '=' + encodeURIComponent(value);
  };

  $.cordys.addOrganizationContextToURL = function (url) {
    var orgDN = $.cordys.getURLParameter(window.location, 'organization');
    if (orgDN) {
      url = $.cordys.addURLParameter(url, 'organization', orgDN);
    }

    // in case of non cordys instalation replace /cordys with the webDirectoryPath set
    if ($.cordys.webDirectoryPath !== null) {
      url = url.replace(/^[/\\]cordys[/\\]/, $.cordys.webDirectoryPath);
    } else {
      // Change to root/org if we have not launched using the /cordys URL
      // Get the Base URL Prefix
      var baseURLMatch = window.location.href.match(
        /[^:]+:[/\\]+[^/\\]+([/\\][^/\\]+[/\\][^/\\]+[/\\])/
      );
      var baseURLPrefix = baseURLMatch ? baseURLMatch[1] : null;
      // Replace /cordys with baseURLPrefix if we have it
      if (baseURLPrefix && !baseURLPrefix.match(/^[/\\]cordys/i)) {
        url = url.replace(/^[/\\]cordys[/\\]/, baseURLPrefix);
        // Prefix relative URLs not starting with /, \ or . with the base URL
        if (!url.match(/^[/\\.]|^[\w]+:[/\\]{2}/)) {
          url = baseURLPrefix + url;
        }
      }
    }
    return url;
  };

  if (typeof btoa == 'undefined') {
    $.cordys.loadScript(
      $.cordys.addOrganizationContextToURL('/cordys/html5/util/base64.js')
    );
  }

  /*  @deprecated
          As RegExp.$1 and RegExp.$2 are not reliable to use and deprecated,
          Use $.cordys.getCookieObject instaed */
  $.cordys.getCookie = function (cookieName) {
    window.console.log(
      '$.cordys.getCookie is deprecated, use $.cordys.getCookieObject instaed'
    );
    return window.document.cookie.search(
      new RegExp('\\b(' + cookieName + ')=([^;]*)')
    ) >= 0
      ? RegExp.$2
      : '';
  };

  /*
          @param cookieName: cookie-name \ regular-expression to find the cookie
          returns object, contains
                                  key: cookie name,
                                  value: cookie value.
      */
  $.cordys.getCookieObject = function (cookieName) {
    var cookie = { key: '', value: '' };
    var matches =
      document.cookie == ''
        ? null
        : document.cookie.match(new RegExp('\\b(' + cookieName + ')=([^;]*)'));
    if (matches && matches.length == '3') {
      cookie.key = matches[1];
      cookie.value = matches[2];
    }
    return cookie;
  };

  $.cordys.deleteAllCookies = function (cookiePath) {
    var cookiePath = cookiePath || $.cordys.cookiePath,
      cookies = document.cookie.split(';');

    for (var i = 0; i < cookies.length; ++i) {
      document.cookie =
        $.trim(cookies[i].split('=')[0]) +
        '=;expires=Thu, 01-Jan-1970 00:00:01 GMT; path=' +
        cookiePath;
    }
  };

  //show the message with title
  $.cordys.showMessage = function (message, title) {
    $.cordys.translation.getSystemBundle().done(function (messageBundle) {
      message = messageBundle.getMessage(message);
      title = title ? messageBundle.getMessage(title) : '';
      if ($.cordys.isMobile) {
        //	$.cordys.mobile.notification.alert(message, null, title);
      } else {
        //	window.alert((title ? (title + ": ") : "") + message);
      }
    });
  };

  // get the top level window from the current window
  $.cordys.getTopLevelWindow = function (currentWindow) {
    var parentWindow = currentWindow.parent || currentWindow.opener;
    if (parentWindow === currentWindow) return currentWindow;
    return $.cordys.getOrigin(parentWindow) ===
      $.cordys.getOrigin(currentWindow)
      ? $.cordys.getTopLevelWindow(parentWindow)
      : currentWindow;
  };

  // get the origin of the window
  $.cordys.getOrigin = function (windowObject) {
    try {
      var location = windowObject.location;
      return location.origin
        ? location.origin
        : location.protocol + '//' + location.host;
    } catch (e) {
      return '';
    }
  };

  if (typeof define === 'function' && define['amd']) {
    define('knockout', ['knockout.src'], function (ko) {
      window.ko = ko;
      return ko;
    });
    define('knockout.mapping', ['knockout.mapping.src'], function (mapping) {
      window.ko['mapping'] = mapping;
    });

    // has to be called by the script loader (Eg:require) when all specified scripts are loaded
    $.cordys.__handleLoading = function () {
      if ($readyCallBack.fired()) return;

      var customScriptObjects = arguments;
      if ($waitDeferreds.length === 0)
        return fireAllSDKLoadedCallBacks(customScriptObjects);
      $.when.apply($, $waitDeferreds).always(function () {
        fireAllSDKLoadedCallBacks(customScriptObjects);
      });
    };

    // called by require when all specified scripts could not be loaded
    $.cordys.__handleLoadingError = function (err) {
      var failedFile = err.requireModules && err.requireModules[0];
      console.error(
        "Could not load the specified JS File(s). Failed to load '" +
        failedFile +
        "'"
      );
    };

    // fires on all sdk-ready handlers passed to the $.cordys.ready fn. The data-include callback is executed after it
    function fireAllSDKLoadedCallBacks(arguments) {
      $readyCallBack.fire();

      if (typeof window[dataIncludeOpts.ready] === 'function') {
        //NOMBV
        window[dataIncludeOpts.ready](arguments); //NOMBV
      } else {
        if (typeof requirejs !== 'undefined') {
          console.error(
            "Could not find function '" +
            dataIncludeOpts.ready +
            "' to be called in the sdk ready"
          );
        }
      }
    }

    var DEFAULT_READY_HANDLER = 'cordys_onready',
      $readyCallBack = $.Callbacks('once', 'memory', 'unique'),
      $waitDeferreds = [];

    // multiple call back handlers can be passed which will be called when the SDK is ready
    $.cordys.ready = function () {
      var args = Array.prototype.slice.call(arguments);
      $readyCallBack.add(args);
    };

    // the SDK ready will be fired after the deferred added to the wait is resolved
    $.cordys.addWait = function () {
      // add all the deferred passed as arguments. Make sure that the SDK ready was not fired yet
      if ($readyCallBack.fired()) {
        return false;
      } else {
        $waitDeferreds.concat(Array.prototype.slice.call(arguments));
        return true;
      }
    };

    var getIncludeOpts = function () {
      var scripts = document.getElementsByTagName('script');
      var requireScript = null;
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].getAttribute('data-main')) {
          requireScript = scripts[i];
          break;
        }
      }

      var result = {};
      if (requireScript) {
        result.ready =
          requireScript.getAttribute('data-ready') || DEFAULT_READY_HANDLER;
        result.config =
          requireScript.getAttribute('data-include-config') || null;
        // get all includes after removing all starting and ending spaces
        result.includes =
          (requireScript.getAttribute('data-include') &&
            requireScript.getAttribute('data-include').split(/\s*,\s*/)) ||
          [];
        return result;
      }
    };
    var dataIncludeOpts;

    $(function () {
      if (
        typeof requirejs !== 'undefined' &&
        requirejs &&
        typeof requirejs.config === 'function'
      ) {
        dataIncludeOpts = getIncludeOpts();
        if (dataIncludeOpts.config) {
          if (window[dataIncludeOpts.config]) {
            //NOMBV
            var dataIncludeRequire = require.config(
              window[dataIncludeOpts.config]
            ); //NOMBV
            dataIncludeRequire(
              dataIncludeOpts.includes,
              $.cordys.__handleLoading,
              $.cordys.__handleLoadingError
            );
          } else {
            console.error(
              "Could not find the data-include-config '" +
              dataIncludeOpts.config +
              "' specified"
            );
          }
        } else {
          require(dataIncludeOpts.includes, $.cordys.__handleLoading, $.cordys
            .__handleLoadingError);
        }
      } else {
        $.cordys.__handleLoading();
      }
    });
  }
})(window, jQuery);
(function (window, $, undefined) {
  var aCache = [],
    rIsNull = /^\s*$/,
    rIsBool = /^(?:true|false)$/i;

  var setDefaultSettings = function () {
    $.cordys.json.defaults = $.extend({}, defaultSettings);
  };

  var defaultSettings = {
    valueProperty: 'text',
    cdataProperty: '',
    attributesProperty: 'keyAttributes',
    attributePrefix: '@',
    defaultVerbosity: 1,
    removeNamespacePrefix: false,
    mapNullToNilAttribute: true,
    reset: setDefaultSettings,
  };

  if (!$.cordys) $.cordys = {};
  $.cordys.json = {};
  setDefaultSettings();

  $.cordys.json.xml2js = function (
    oXMLParent,
    nVerbosity /* optional */,
    bFreeze /* optional */,
    bNestedAttributes /* optional */
  ) {
    // if the nVerbosity parameter is an object, we assume it is the settings object
    if (typeof nVerbosity === 'object') {
      var settings = $.extend({}, $.cordys.json.defaults, nVerbosity);
      return getObjectTreeBuilder(settings)(oXMLParent);
    }

    // for backward compatibility as settings were allowed as parameters earlier
    return $.cordys.json.xml2js(oXMLParent, {
      verbosity: nVerbosity,
      freeze: bFreeze,
      nestedAttributes: bNestedAttributes,
    });
  };

  if (typeof XMLSerializer == 'undefined') {
    XMLSerializer = function () { };
    XMLSerializer.prototype.serializeToString = function (inputXML) {
      return inputXML.xml;
    };
    document.XMLSerializer = XMLSerializer;
  }

  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^[\s]+/, '').replace(/[\s]+$/, '');
    };
  }

  $.cordys.json.xml2jsstring = function (
    oXMLParent,
    nVerbosity /* optional */,
    bFreeze /* optional */,
    bNestedAttributes /* optional */
  ) {
    if (!oXMLParent) return null;
    // if the nVerbosity parameter is an object, we assume it is the settings object
    return JSON.stringify(
      $.cordys.json.xml2js(oXMLParent, nVerbosity, bFreeze, bNestedAttributes)
    );
  };

  $.cordys.json.js2xml = function (oObjTree, parentElement, settings) {
    var oNewDoc = parentElement
      ? parentElement.ownerDocument
      : getXMLDocument();
    parentElement = parentElement || oNewDoc;
    var settings = $.extend({}, $.cordys.json.defaults, settings);
    getXMLBuilder(settings)(oNewDoc, parentElement, oObjTree);
    return parentElement;
  };

  $.cordys.json.js2xmlstring = function (oObjTree, settings) {
    var oNewDoc = getXMLDocument();
    var wrappedXML = $.cordys.json.js2xml(
      oObjTree,
      createXMLElement(oNewDoc, oNewDoc, '', 'o'),
      settings
    );
    var sXML =
      wrappedXML.xml || new XMLSerializer().serializeToString(wrappedXML); //For IE
    //for IE11, empty name space added automatically (xmlns:NS1="" NS1:xmlns:ns1="URL"), check the value like 'xmlns:NS1="" NS1:', and replacing the pattern with space. https://jira.opentext.com/browse/BOP-69386
    if (isIE11) {
      sXML = sXML.replace(new RegExp('xmlns:NS\\d+=""\\sNS\\d+:', 'g'), '');
    }
    // remove the temporary object
    if (sXML.lastIndexOf('</o>') === sXML.length - 4) {
      return sXML.slice(3, sXML.length - 4);
    } else {
      return sXML.slice(3, sXML.length - 2);
    }
  };

  $.cordys.json.find = function (obj, name, val) {
    // Finding all the objects with a certain name.
    // It returns:
    // - null if nothing found
    // - a single object if 1 result found
    // - an array if multiple results found
    var obj = getObj(obj, name, val);
    return obj.length === 0 ? null : obj.length === 1 ? obj[0] : obj;
  };

  $.cordys.json.findObjects = function (obj, name, val) {
    // Finding all the objects with a certain name and always returns an array
    return getObj(obj, name, val);
  };

  var getXMLDocument = function () {
    var oNewDoc = null;
    if (window.ActiveXObject) {
      oNewDoc = new ActiveXObject('Microsoft.XMLDOM'); // For IE
    } else {
      oNewDoc = document.implementation.createDocument('', '', null);
    }
    return oNewDoc;
  };

  function getObj(obj, key, val) {
    var objects = [];
    for (var i in obj) {
      if (!obj.hasOwnProperty(i)) continue;
      if (typeof obj[i] == 'object') {
        if (i == key) {
          if ($.isArray(obj[i])) {
            for (var j = 0; j < obj[i].length; j++) {
              objects.push(obj[i][j]);
            }
          } else {
            objects.push(obj[i]);
          }
        } else {
          objects = objects.concat(getObj(obj[i], key, val));
        }
      } else if (i == key && obj[key] == val) {
        objects.push(obj);
      }
    }
    return objects;
  }

  function parseText(sValue) {
    if (rIsNull.test(sValue)) {
      return null;
    }
    //	if (rIsBool.test(sValue)) { return sValue.toLowerCase() === "true"; }
    //	if (isFinite(sValue)) { return parseFloat(sValue); }
    //	if (isFinite(Date.parse(sValue))) { return new Date(sValue); }
    return sValue;
  }

  function objectify(vValue) {
    return vValue === null
      ? {}
      : vValue instanceof Object
        ? vValue
        : new vValue.constructor(vValue);
  }

  function getObjectTreeBuilder(settings) {
    var nVerb =
      typeof settings.verbosity === 'number'
        ? settings.verbosity & 3
        : $.cordys.json.defaults.defaultVerbosity;

    var bFreeze = settings.freeze || false,
      bNesteAttr = settings.nestedAttributes || nVerb === 3,
      bHighVerb = Boolean(nVerb & 2);
    var createObjTree = function (oParentNode) {
      var bAttributes = oParentNode.hasAttributes
        ? oParentNode.hasAttributes()
        : oParentNode.attributes
          ? oParentNode.attributes.length > 0
          : false; //For IE
      var bChildren = oParentNode.hasChildNodes(),
        sProp,
        vContent,
        nLength = 0,
        sCollectedTxt = '',
        vResult = bHighVerb
          ? {}
          : /* put here the default value for empty nodes: */ '';
      var nLevelStart = aCache.length,
        bCDataNode = false;

      if (
        bAttributes &&
        settings.mapNullToNilAttribute === true &&
        (oParentNode.getAttribute('xsi:nil') === 'true' ||
          oParentNode.getAttribute('null') === 'true')
      ) {
        bAttributes = false; // skip the attributes
        vResult = null; // value will be 'null'
      }

      if (bChildren) {
        for (
          var oNode, nChildId = 0;
          nChildId < oParentNode.childNodes.length;
          nChildId++
        ) {
          oNode = oParentNode.childNodes.item(nChildId);
          if (oNode.nodeType === 4) {
            sCollectedTxt += oNode.nodeValue;
            bCDataNode = true;
          } /* nodeType is "CDATASection" (4) */ else if (
            oNode.nodeType === 3
          ) {
            sCollectedTxt += oNode.nodeValue.trim();
          } /* nodeType is "Text" (3) */ else if (oNode.nodeType === 1) {
            aCache.push(oNode);
          } /* nodeType is "Element" (1) */
        }
      }

      var nLevelEnd = aCache.length,
        vBuiltVal = parseText(sCollectedTxt);

      if (!bHighVerb && (bChildren || bAttributes)) {
        vResult = nVerb === 0 ? objectify(vBuiltVal) : {};
      }

      for (var nElId = nLevelStart; nElId < nLevelEnd; nElId++) {
        sProp =
          settings.removeNamespacePrefix === true
            ? aCache[nElId].localName
              ? aCache[nElId].localName
              : aCache[nElId].nodeName.replace(/^[^:]*:/, '')
            : aCache[nElId].nodeName; // localName is not supported in IE7 and IE8
        vContent = createObjTree(aCache[nElId], settings);
        if (vResult.hasOwnProperty(sProp)) {
          if (!(vResult[sProp] instanceof Array)) {
            vResult[sProp] = [vResult[sProp]];
          }
          vResult[sProp].push(vContent);
        } else {
          vResult[sProp] = vContent;
          nLength++;
        }
      }

      if (bAttributes) {
        var nAttrLen = oParentNode.attributes.length,
          sAPrefix = bNesteAttr ? '' : settings.attributePrefix,
          oAttrParent = bNesteAttr ? {} : vResult;

        for (
          var oAttrib, nAttrib = 0;
          nAttrib < nAttrLen;
          nLength++, nAttrib++
        ) {
          oAttrib = oParentNode.attributes.item(nAttrib);
          oAttrParent[sAPrefix + oAttrib.nodeName] = parseText(
            oAttrib.nodeValue.trim()
          );
        }

        if (bNesteAttr) {
          if (bFreeze) {
            Object.freeze(oAttrParent);
          }
          vResult[settings.attributesProperty] = oAttrParent;
          nLength -= nAttrLen - 1;
        }
      }

      if (vResult !== null) {
        if (bCDataNode && settings.cdataProperty)
          vResult[settings.cdataProperty] = vBuiltVal;
        else {
          if (
            nVerb === 3 ||
            ((nVerb === 2 || (nVerb === 1 && nLength > 0)) && sCollectedTxt)
          ) {
            vResult[settings.valueProperty] = vBuiltVal;
          } else if (!bHighVerb && nLength === 0 && sCollectedTxt) {
            vResult = vBuiltVal;
          }
        }

        if (bFreeze && (bHighVerb || nLength > 0)) {
          Object.freeze(vResult);
        }
      }

      aCache.length = nLevelStart;

      return vResult;
    };
    return createObjTree;
  }

  function getXMLBuilder(settings) {
    var loadObjTree = function (oXMLDoc, oParentEl, oParentObj) {
      var vValue, oChild;
      if (oParentObj === undefined) return;
      var objType = typeof oParentObj;
      if (
        oParentObj instanceof String ||
        oParentObj instanceof Number ||
        oParentObj instanceof Boolean ||
        objType == 'string' ||
        objType == 'number' ||
        objType == 'boolean'
      ) {
        oParentEl.appendChild(
          oXMLDoc.createTextNode(oParentObj.toString())
        ); /* verbosity level is 0 */
      } else if (oParentObj.constructor === Date) {
        oParentEl.appendChild(oXMLDoc.createTextNode(oParentObj.toGMTString()));
      }

      if (oParentObj.constructor === Array) {
        for (var nItem = 0; nItem < oParentObj.length; nItem++) {
          loadObjTree(oXMLDoc, oParentEl, oParentObj[nItem]);
        }
      } else {
        for (var sName in oParentObj) {
          if (!oParentObj.hasOwnProperty(sName)) return;
          if (isFinite(sName)) {
            continue;
          } /* verbosity level is 0 */
          vValue = oParentObj[sName];
          if (typeof vValue === 'function') vValue = vValue(); // in case of KO, value can be an observable.

          if (sName === settings.valueProperty) {
            if (vValue !== null && vValue !== true) {
              oParentEl.appendChild(
                oXMLDoc.createTextNode(
                  vValue.constructor === Date
                    ? vValue.toGMTString()
                    : String(vValue)
                )
              );
            }
          } else if (sName === settings.cdataProperty) {
            if (vValue !== null && vValue !== true) {
              oParentEl.appendChild(
                oXMLDoc.createCDATASection(
                  vValue.constructor === Date
                    ? vValue.toGMTString()
                    : String(vValue)
                )
              );
            }
          } else if (sName === settings.attributesProperty) {
            /* verbosity level is 3 */
            for (var sAttrib in vValue) {
              oParentEl.setAttribute(sAttrib, vValue[sAttrib]);
            }
          } else if (sName.charAt(0) === settings.attributePrefix) {
            oParentEl.setAttribute(sName.slice(1), new String(vValue)); //For IE
          } else if (typeof vValue === 'undefined') {
            oParentEl.appendChild(
              createXMLElement(oXMLDoc, oParentEl, vValue, sName)
            );
          } else if (vValue !== null && vValue.constructor === Array) {
            for (var nItem = 0; nItem < vValue.length; nItem++) {
              oChild = createXMLElement(oXMLDoc, oParentEl, '', sName);
              oParentEl.appendChild(oChild);
              loadObjTree(oXMLDoc, oChild, vValue[nItem]);
            }
          } else {
            oChild = createXMLElement(oXMLDoc, oParentEl, vValue, sName);
            if (vValue instanceof Object) {
              loadObjTree(oXMLDoc, oChild, vValue);
            } else if (vValue !== null && vValue !== true) {
              oChild.appendChild(oXMLDoc.createTextNode(vValue.toString()));
            } else if (vValue === null) {
              oChild.setAttribute('null', 'true');
              if (oChild.setAttributeNS) {
                oChild.setAttributeNS(
                  'http://www.w3.org/2001/XMLSchema-instance',
                  'xsi:nil',
                  'true'
                );
              } else {
                oChild.setAttribute('xsi:nil', 'true');
                oChild.setAttribute(
                  'xmlns:xsi',
                  'http://www.w3.org/2001/XMLSchema-instance'
                );
              }
            }
            oParentEl.appendChild(oChild);
          }
        }
      }
    };
    return loadObjTree;
  }

  var userAgent = navigator.userAgent,
    isFirefox = /Firefox/.test(userAgent),
    isOpera = /Opera/.test(userAgent),
    isSafari = /Safari/.test(userAgent),
    isIE = /MSIE/.test(userAgent);
  var isIE11 = /Trident.*rv[:]*11/.test(userAgent);

  function createXMLElement(oXMLDoc, oParentEl, vValue, sName) {
    // Use createElementNS only in Firefox/Opera/Safari if we have xmlns attribute
    if (vValue && vValue['@xmlns'] && (isFirefox || isOpera || isSafari)) {
      return oXMLDoc.createElementNS(vValue['@xmlns'], sName);
    }

    // Set the namespaceURI if we have namespaceURI in parent to avoid empty namespaceURI in child nodes
    if (oParentEl && oParentEl.namespaceURI) {
      var parentNamespace = oParentEl.namespaceURI;
      // IE will support createNode for creating an element with namespaceURI
      return isIE
        ? oXMLDoc.createNode(1, sName, parentNamespace)
        : oXMLDoc.createElementNS(parentNamespace, sName);
    }
    return oXMLDoc.createElement(sName);
  }
})(window, jQuery);

/**
 * Cordys Ajax Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  if (!$.cordys) $.cordys = {};
  if (!$.cordys.json) {
    $.cordys.loadScript('/cordys/html5/util/jxon.js');
  }

  var activeRequestsCount = 0,
    loadingTimer = null,
    hideLoadingTimer = null;

  $.ajaxSetup({
    converters: {
      'xml json': function (data) {
        return convertXMLResponseToJSON(data);
      },
    },
  });

  function convertXMLResponseToJSON(data, conversionSettings) {
    var soapBody = $(data).find('Body, SOAP\\:Body');
    var responseNode = soapBody ? soapBody.children()[0] : data;
    // Check whether the response is for a  multi call response
    if (
      responseNode.tagName ===
      'multicall:__Cordys_MultipleRequestWrapperResponse'
    ) {
      var jsonResponse = [];
      // Form the Json response Object for all the responses
      $.each(
        $(responseNode).find('Body, SOAP\\:Body'),
        function (index, value) {
          jsonResponse.push(
            $.cordys.json.xml2js(value.firstChild, conversionSettings)
          );
        }
      );
      return jsonResponse;
    } else {
      return $.cordys.json.xml2js(responseNode, conversionSettings);
    }
  }

  // Function that will stop copying content and url object structure
  function ajaxExtend(target, src) {
    var key,
      deep,
      flatOptions = jQuery.ajaxSettings.flatOptions || {};
    for (key in src) {
      if (src[key] !== undefined) {
        (flatOptions[key] ? target : deep || (deep = {}))[key] = src[key];
      }
    }
    if (deep) {
      jQuery.extend(true, target, deep);
    }
    return target;
  }

  $.cordys.ajax = function (options) {
    var requestStartTime = new Date().getTime(); // for handling multiple requests in the login
    var opts = $.extend({}, $.cordys.ajax.defaults);
    opts = ajaxExtend(opts, options);

    if (opts.dataType === 'json') {
      console.log(
        "Ajax dataType attribute is set to 'json'. This works only if the response from the server is json."
      );
      console.log("For SOAP Calls, remove the dataType or set it to '* json'.");
    }

    if (true) {
      var ctCookie = $.cordys.getCookieObject('\\w*_ct');
      // Use configurable base URL or default to relative path
      var baseURL = $.cordys.baseURL || '';
      var gatewayPath = baseURL + '/com.eibus.web.soap.Gateway.wcp';
      if (ctCookie) {
        opts.url = $.cordys.addURLParameter(
          gatewayPath,
          ctCookie.key,
          ctCookie.value
        );
        opts.url = $.cordys.addURLParameter(opts.url, 'timeout', 180000);
      } else {
        opts.url = gatewayPath;
        opts.url = $.cordys.addURLParameter(opts.url, 'timeout', 180000);
      }
    } else {
      opts.url = configureGatewayUrl(opts.url, opts);
      if (!opts.url) return null;
    }
    var dataStrings = [];

    if (opts.request) {
      var request = opts.request;
      if ($.isArray(request)) {
        //Check for a multicall request

        dataStrings.push(
          "<SOAP:Envelope xmlns:SOAP='http://schemas.xmlsoap.org/soap/envelope/'><SOAP:Body><multicall:__Cordys_MultipleRequestWrapper xmlns:multicall='http://schemas.cordys.com/1.0/ldap'>"
        );
        for (var count = 0; count < request.length; count++) {
          dataStrings.push(
            typeof request[count].data === 'undefined'
              ? makeRequest(request[count], opts)
              : request[count].data
          );
        }
        dataStrings.push(
          '</multicall:__Cordys_MultipleRequestWrapper></SOAP:Body></SOAP:Envelope>'
        );
      } else {
        dataStrings.push(
          typeof request.data === 'undefined'
            ? makeRequest(request, opts)
            : request.data
        );
      }
    } else {
      dataStrings.push(
        typeof opts.data === 'undefined' ? makeRequest(opts, opts) : opts.data
      );
    }

    opts.data = dataStrings.join('');

    if (typeof opts.error === 'function') {
      opts.__error = opts.error;
    }
    opts.error = function (jqXHR, textStatus, errorThrown) {
      console.log('Error Response received ', jqXHR, jqXHR.fail());
      var messCode = '',
        responseText = jqXHR.fail().responseText,
        responseXML = jqXHR.fail().responseXML;

      //Escaping special characters from response string because of which jquery selector is unable to read it.
      responseText = responseText.replace(
        /([#;?%&,.+*~\':"!^$[\]()=><|\/@{\}_])/g,
        '\\$1'
      );

      if (responseXML) {
        // check for IE
        responseXML =
          responseXML instanceof Object ? responseXML : responseXML.xml; //NOMBV
        messCode = $(responseXML).find('MessageCode').text();
      }
      if (!messCode && responseText) {
        messCode = $(responseText).find('cordys\\:messagecode').text();
      }

      if (
        messCode.search(/Cordys.*(AccessDenied|Artifact_Unbound)/) >= 0 ||
        jqXHR.statusText === 'Forbidden'
      ) {
        // login to Cordys with cookie reset is true
        $.cordys.authentication
          .login(true, requestStartTime, { async: opts.async })
          .done(function () {
            //NOMBV
            // reload the page after login success
            window.location.reload();
          });
      } else {
        if (!jqXHR.fail().responseText && !jqXHR.fail().responseXML) return; // skip this error, there is no description
        var showError = true;
        var errorMessage =
          $(jqXHR.fail().responseXML).find('faultstring,error elem').text() ||
          jqXHR.responseText;
        if (opts.__error && typeof opts.__error === 'function') {
          showError =
            opts.__error(
              jqXHR,
              textStatus,
              errorThrown,
              messCode,
              errorMessage,
              opts
            ) !== false;
        }
        if (showError) {
          $.cordys.showMessage(errorMessage, 'Error');
        }
      }
    };

    // modify the default login url if we have the login url in the request
    if (opts.loginUrl) {
      $.cordys.authentication.defaults.loginURL = opts.loginUrl;
    }

    opts._beforeSend = opts.beforeSend;
    opts.beforeSend = function (jqXHR, settings) {
      activeRequestsCount++;
      // Call beforeSend of the request if already available
      if (typeof opts._beforeSend === 'function') {
        if (opts._beforeSend.call(this, jqXHR, settings) === false) {
          return false;
        }
      }
      // Show the progress icon if it is enabled
      if (opts.showLoadingIndicator && opts.isMock === false) {
        showLoadingIndicator(opts);
      }
    };

    if (options.json) {
      opts.converters = {
        'xml json': function (data) {
          return convertXMLResponseToJSON(data, options.json);
        },
      };
    }

    // let us just send the request if we are mocking
    if (opts.isMock === true) {
      return sendRequest(opts);
    } else {
      return sendRequest(opts).always(function () {
        activeRequestsCount--;
        // Hide the progress icon once the request is processed
        if (opts.showLoadingIndicator) {
          hideLoadingIndicator(opts);
        }
      });
    }
  };

  function sendRequest(opts) {
    // let us set the ct cookie if we have one
    setCookiesToUrl(opts);
    if (opts.method) {
      delete opts.method; // removing method parameter from opts as in jquery 1.10 ticket #12004 effecting our scenario
    }
    return $.ajax(opts);
  }

  function makeRequest(request, opts) {
    var dataStrings = [];
    if (request.method && request.namespace) {
      dataStrings.push(
        "<SOAP:Envelope xmlns:SOAP='http://schemas.xmlsoap.org/soap/envelope/'><SOAP:Body><"
      );
      dataStrings.push(request.method);
      dataStrings.push(" xmlns='");
      dataStrings.push(request.namespace);
      dataStrings.push("' ");
      dataStrings.push('>');
      if (request.parameters) {
        var parameterXML = getParameterString(request.parameters, opts);
        if (parameterXML) {
          // if the parameters has attributes that needs to assigned to the method, then let us remove
          // the closing '>' of the method
          if (parameterXML.charAt(0) !== '<') {
            dataStrings.pop();
          }
          dataStrings.push(parameterXML);
        }
      }
      dataStrings.push('</' + request.method + '>');
      dataStrings.push('</SOAP:Body></SOAP:Envelope>');
      return dataStrings.join('');
    }
  }

  $.cordys.ajax.defaults = {
    url: '',
    async: true,
    isMock: false,
    type: 'POST',
    contentType: 'text/xml; charset="utf-8"',
    dataType: '* json',
    cache: false,
    headers: { 'cache-control': 'no-cache' },
    showLoadingIndicator: true,
    responseWaitTime: 500, // wait time in MilliSeconds to show the loading indicator
  };

  $.cordys.ajax.getActiveRequestsCount = function () {
    return activeRequestsCount;
  };

  // Show the jquery mobile loading icon if jquery mobile is available
  // Else create a new div and show the progress bar
  function showLoadingIndicator(opts) {
    opts.isResponseReceived = false;
    // show loading indicator only if it is not already present
    if (!loadingTimer) {
      loadingTimer = window.setTimeout(function () {
        if (!opts.isResponseReceived) {
          if ($.mobile) {
            $.mobile.loading('show');
          } else if ($('#_Cordys_Ajax_LoadingIndicator').length === 0) {
            var imgDiv = $("<div id='_Cordys_Ajax_LoadingIndicator'/>");
            $('body').append(imgDiv);
            imgDiv.css({
              //"background":"url(/cordys/html5/images/custom-loader.gif) no-repeat center center",
              height: '100px',
              width: '100px',
              position: 'fixed',
              left: '50%',
              top: '50%',
              margin: '-25px 0 0 -25px',
              'z-index': '1000',
            });
          } else if ($('#_Cordys_Ajax_LoadingIndicator').length > 0) {
            $('#_Cordys_Ajax_LoadingIndicator').css({ display: 'block' });
          }
        }
      }, opts.responseWaitTime);
    }
  }

  function hideLoadingIndicator(opts) {
    opts.isResponseReceived = true;
    // hide indicator only after all the active requests are complete
    if ($.cordys.ajax.getActiveRequestsCount() == 0) {
      hideLoadingTimer = window.setTimeout(function () {
        if ($.cordys.ajax.getActiveRequestsCount() == 0) {
          if ($.mobile) {
            $.mobile.loading('hide');
          } else if ($('#_Cordys_Ajax_LoadingIndicator').length > 0) {
            $('#_Cordys_Ajax_LoadingIndicator').css({ display: 'none' });
          }
          clearTimeout(loadingTimer);
          loadingTimer = null;
        }
        clearTimeout(hideLoadingTimer);
        hideLoadingTimer = null;
      }, 200);
    }
  }

  function configureGatewayUrl(url, options) {
    return url
      ? url
        .replace(/^http:\//, window.location.protocol + '/')
        .replace(/\/localhost\//, '/' + window.location.host + '/')
      : $.cordys.addOrganizationContextToURL('com.eibus.web.soap.Gateway.wcp');
  }

  function setCookiesToUrl(options) {
    if (options.isMock !== true) {
      var ctCookie = $.cordys.getCookieObject('\\w*_ct'); // cookie name can be different, when property gateway.csrf.cookiename is set
      if (ctCookie) {
        options.url = $.cordys.addURLParameter(
          options.url,
          ctCookie.key,
          ctCookie.value
        );
      }
    }
  }

  function getParameterString(parameters, settings) {
    var pStrings = [];
    if ($.isArray(parameters)) {
      for (var i = 0, len = parameters.length; i < len; i++) {
        var par = parameters[i];
        pStrings.push('<' + par.name + '>');
        pStrings.push(
          typeof par.value === 'function' ? par.value() : par.value
        ); //NOMBV
        pStrings.push('</' + par.name + '>');
      }
    } else if (typeof parameters === 'object') {
      if ($.cordys.json)
        pStrings.push($.cordys.json.js2xmlstring(parameters, settings.json));
      else {
        for (var par in parameters) {
          pStrings.push('<' + par + '>');
          pStrings.push(
            typeof parameters[par] === 'function'
              ? parameters[par]()
              : parameters[par]
          );
          pStrings.push('</' + par + '>');
        }
      }
    } else if (typeof parameters === 'function') {
      if (typeof settings.context === 'object') {
        pStrings.push(parameters.call(settings.context, settings));
      } else {
        pStrings.push(parameters(settings));
      }
    } else if (typeof parameters === 'string') {
      pStrings.push(parameters);
    }
    return pStrings.join('');
  }
})(window, jQuery);
/**
 * Cordys Authentication Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  var userDetails,
    preloginInfo = null,
    topLevelWindow = $.cordys.getTopLevelWindow(window), // get the top level window for creating login deferred
    SAMLART_NAME = 'SAMLart',
    AUTH_TYPE = { SAML2: 'saml2', OTDS: 'otds', CORDYS: 'cordys' }, // lower case is considered to enable case insensitive comparision when using them.
    l$Cordys_LoginDef = null;

  topLevelWindow.$Cordys_LoginDef = null;

  $.cordys.authentication = {
    // get user method returns the user and organization details.
    getUser: function () {
      var $GetUserDef = $.Deferred();

      if (userDetails) {
        $GetUserDef.resolve(userDetails);
      } else {
        $.cordys
          .ajax({
            method: 'GetUserDetails',
            namespace: 'http://schemas.cordys.com/1.0/ldap',
          })
          .then(function (response) {
            var organization;
            var userDN = '';
            var organizationDN = '';
            userDetails = {};
            var organizationDetails = response.tuple.old.user.organization;
            organizationObjects =
              $.type(organizationDetails) === 'array'
                ? organizationDetails
                : [organizationDetails];
            organization = getOrganizationName(organizationObjects);
            // mathching the organization DN.
            var orgPattern = new RegExp('^o=' + organization + ',', 'i');
            $.each(organizationObjects, function (i, value) {
              if (orgPattern.test(value.dn)) {
                organizationDN = value.dn;
                userDN = value.organizationaluser.dn;
                return false; // stop here
              }
            });
            userDetails.userDN = userDN;
            userDetails.organizationDN = organizationDN;
            userDetails.organizationName = organization;
            userDetails.userName = userDN.substring(
              userDN.indexOf('cn=') + 3,
              userDN.indexOf(',')
            );
            $GetUserDef.resolve(userDetails);
          });
      }
      return $GetUserDef;
    },

    // get prelogin information such as saml_name, ct_name, and cookie path
    getPreloginInfo: function (opts) {
      var deferred = $.Deferred();
      // let us return the preloginInfo if we already have it
      if (preloginInfo) {
        return deferred.resolve(preloginInfo);
      }

      var prelogin = opts
        ? $.extend({}, getPreloginRequest(), opts)
        : getPreloginRequest();

      $.ajax(prelogin)
        .done(function (data) {
          preloginInfo = $.cordys.json.xml2js(data).PreLoginInfo;
          deferred.resolve(preloginInfo);
        })
        .fail(function (e, statusText, errorThrown) {
          deferred.reject(e, statusText, errorThrown);
        });

      return deferred.promise();
    },

    login: function (reset, requestStartTime, opts) {
      // Check if we have already started with login or we have already done with it
      if (this.isLoginPending() || (this.isLoginCompleted() && reset !== true))
        return topLevelWindow.$Cordys_LoginDef.promise();

      // if request was initially sent before login was initiated, then we can return the same deferred
      if (
        this.isLoginCompleted() &&
        reset === true &&
        requestStartTime &&
        requestStartTime > topLevelWindow.$Cordys_LoginDef.startTime &&
        requestStartTime < topLevelWindow.$Cordys_LoginDef.successTime
      ) {
        return topLevelWindow.$Cordys_LoginDef.promise();
      }

      // let us set a local reference so that we do not lose it in the handlers when some one else
      // resolves it and creates another differed
      l$Cordys_LoginDef = this.setLoginStarted();

      // if we are in the native app, return a deferred which will get resolved after getting the cookie
      // from the native app
      if ($.cordys.isMobile && $.cordys.cookie) {
        $.cordys.cookie.getCookies($.cordys.serverId, reset).done(function () {
          if (reset === true) {
            // reload in case it was an expiry case
            window.location.reload();
          } else {
            $.cordys.authentication.setLoginCompleted();
          }
        });
        return l$Cordys_LoginDef.promise();
      }

      this.getPreloginInfo(opts)
        .done(function (preloginInfo) {
          var authenticationMode = preloginInfo.AuthConfigMode;

          // Start the renew process if SAML is available and renew process is not started
          l$Cordys_LoginDef.done(function (samlArt) {
            if (samlArt) {
              $.cordys.authentication.sso.initializeSessionFromArtifact(
                samlArt
              );
            }
          });

          // nothing to do in case of Web Server authentication
          if (authenticationMode === 'WebServer') {
            $.cordys.authentication.setLoginCompleted();
          }

          // Cordys SSO authentication
          else if (authenticationMode === 'CordysSSO') {
            // Show the login screen if we do not have a cookie or we need a new cookie
            if (reset) {
              showLoginPage();
            }
            // check whether the ct is available in cookie or not
            else if (!$.cordys.authentication.sso.isAuthenticated()) {
              var samlArtInURL = $.cordys.getURLParameter(
                window.location,
                SAMLART_NAME
              ),
                samlArtInCookie = $.cordys.getCookieObject(
                  preloginInfo.SamlArtifactCookieName.text
                ).value; //NOMBV(2)

              // check whether the saml artifact is passed as a url parameter. If so initialize session with that Artifact
              if (samlArtInURL) {
                samlArtInURL !== samlArtInCookie
                  ? $.cordys.authentication.setLoginCompleted(samlArtInURL)
                  : $.cordys.authentication.setLoginCompleted(samlArtInCookie);
              }
              // incase of external IDP, SAMLArt is available in cookie, so initiate a new session with that SAMLArt
              else if (samlArtInCookie) {
                $.cordys.authentication.setLoginCompleted(samlArtInCookie);
              }
              // if no SAMLArt or ct in cookie, show the login screen with the configured URL
              else {
                showLoginPage();
              }
            }
            // nothing to do if ct is available in cookie
            else {
              // Start the renew process in case the ct and SAML is already available in cookie
              var samlArt = $.cordys.getCookieObject('\\w*_SAMLart').value; //NOMBV
              $.cordys.authentication.setLoginCompleted(samlArt);
            }
          }
        })
        .fail($.cordys.authentication.defaults.preLoginErrorHandler);

      return l$Cordys_LoginDef.promise();
    },

    // logout will delete the cookies and will call the login again
    logout: function () {
      this.getPreloginInfo().done(function (preloginInfo) {
        var authenticatorType = preloginInfo.Authenticator.Type.toLowerCase();
        topLevelWindow.$Cordys_LoginDef = null;

        // Clear the assertion and stop the renew process
        $.cordys.authentication.sso.clearAssertions(preloginInfo);
        if (authenticatorType === AUTH_TYPE.CORDYS) {
          $.cordys.authentication.login(true);
        } else if (authenticatorType === AUTH_TYPE.SAML2) {
          showLogoutPage($.cordys.authentication.defaults.ssoLogoutURL);
        }
      });
    },

    // mark that we have started with the login process
    setLoginStarted: function () {
      // Create a login deferred.
      topLevelWindow.$Cordys_LoginDef = this.isLoginPending()
        ? topLevelWindow.$Cordys_LoginDef
        : $.Deferred();
      topLevelWindow.$Cordys_LoginDef.startTime = new Date().getTime();
      return topLevelWindow.$Cordys_LoginDef;
    },

    // returns true if we are inside the login process
    isLoginPending: function () {
      return (
        topLevelWindow.$Cordys_LoginDef &&
        topLevelWindow.$Cordys_LoginDef.state() === 'pending'
      );
    },

    // returns true if we are inside the login process
    isLoginCompleted: function () {
      return (
        topLevelWindow.$Cordys_LoginDef &&
        topLevelWindow.$Cordys_LoginDef.state() === 'resolved'
      );
    },

    setLoginFailed: function () {
      // reject the login deferred once the authentication is failed
      if (topLevelWindow.$Cordys_LoginDef) {
        topLevelWindow.$Cordys_LoginDef.reject();
      }
    },

    setLoginCompleted: function (samlArt) {
      // resolve the login deferred once the authentication is completed
      if (topLevelWindow.$Cordys_LoginDef) {
        topLevelWindow.$Cordys_LoginDef.successTime = new Date().getTime();
      }
      if (l$Cordys_LoginDef) {
        l$Cordys_LoginDef.resolve(samlArt);
      }
    },
  };

  $.cordys.authentication.defaults = {
    logMeInURL: 'wcp/sso/com.eibus.sso.web.authentication.LogMeIn.wcp',
    preloginGatewayURL: 'com.eibus.sso.web.authentication.PreLoginInfo.wcp',
    loginURL: $.mobile
      ? '/cordys/html5/mobilelogin.htm'
      : '/cordys/html5/login.htm',
    ssoLoginURL: $.mobile
      ? '/cordys/html5/ssologin.htm'
      : 'wcp/sso/com.eibus.sso.web.authentication.LogMeIn.wcp',
    ssoLogoutURL: $.mobile
      ? '/cordys/html5/ssologout.htm'
      : 'wcp/sso/com.eibus.sso.web.authentication.LogMeOut.wcp',
    preLoginErrorHandler: preLoginErrorHandler,
    loginErrorHandler: loginErrorHandler,
  };

  function redirectToIDP() {
    var redirectURL = $.cordys.addOrganizationContextToURL(
      $.cordys.authentication.defaults.logMeInURL
    );
    redirectURL = $.cordys.addURLParameter(
      redirectURL,
      'organization',
      getCurrentOrganizationDN()
    );
    $.cordys.preferences.getUserPreferences().done(function (preferences) {
      var language =
        preferences && preferences.language
          ? preferences.language
          : getLanguage();
      redirectURL = $.cordys.addURLParameter(redirectURL, 'language', language);
      redirectURL = $.cordys.addURLParameter(
        redirectURL,
        'RelayState',
        window.location.pathname + window.location.search + window.location.hash
      );
      window.location = redirectURL;
    });
  }

  // get the prelogin request
  function getPreloginRequest() {
    return {
      contentType: 'text/xml; charset="utf-8"',
      type: 'get',
      dataType: 'xml',
      url: $.cordys.authentication.defaults.preloginGatewayURL,
      cache: false,
      headers: { 'cache-control': 'no-cache' },
    };
  }

  // get the user details request
  function getUserDetailsRequest() {
    return (
      '<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<SOAP:Body>' +
      '<GetUserDetails xmlns="http://schemas.cordys.com/1.0/ldap"/>' +
      '</SOAP:Body>' +
      '</SOAP:Envelope>'
    );
  }

  // get the current organization DN by synchronous request
  function getCurrentOrganizationDN() {
    var organizationFromUrl = getOrganizationFromUrl().toLowerCase(),
      currentOrganizationDN = '';
    $.ajax({
      contentType: 'text/xml; charset="utf-8"',
      type: 'post',
      dataType: '* json',
      data: getUserDetailsRequest(),
      url: 'com.eibus.web.soap.Gateway.wcp',
      async: false,
    }).done(function (userDetails) {
      var organizationObjects = $.cordys.json.findObjects(
        userDetails,
        'organization'
      );
      $.each(organizationObjects, function (i, value) {
        // check for getting the current organization DN
        // or default organization if base URL prefix is cordys
        if (
          (organizationFromUrl === 'cordys' && value['@default']) ||
          value.description.toLowerCase() === organizationFromUrl
        ) {
          currentOrganizationDN = value.dn;
          return false; // return back from each.
        }
      });
    });
    return currentOrganizationDN;
  }

  // returns the organization name from url
  function getOrganizationFromUrl() {
    var location = window.location,
      organization = $.cordys.getURLParameter(location, 'organization');
    if (organization && organization.indexOf(',') != 0) {
      return organization; // take the organization parameter
    } else if (location.toString().split('/')[3] === 'cordys') {
      return 'cordys'; // use default organization if baseurl is cordys
    } else {
      return decodeURIComponent(location.toString().split('/')[4]); // then based on the organization in the url
    }
  }

  // get Language from the browser
  function getLanguage() {
    var language = $.cordys.getURLParameter(window.location, 'language');
    return language
      ? language
      : window.navigator.language || window.navigator.userLanguage; //userLanguage is specific to IE
  }

  // add url data for change page
  function addUrlData(urlData, name, value) {
    var parSeperator = urlData ? '&' : '';
    return value ? urlData + parSeperator + name + '=' + value : urlData;
  }

  // shows the Cordys SSO or saml2 login screen
  function showLoginPage() {
    var authenticatorType = preloginInfo.Authenticator.Type.toLowerCase();
    if (authenticatorType === AUTH_TYPE.OTDS) {
      redirectToIDP();
      // return statement is required to avoid processing of futher(un-neccesary) code as location replace is not causing immediate affect.
      return;
    }
    var loginURL = $.cordys.authentication.defaults.loginURL,
      preferredLoginURL = $.cordys.authentication.defaults.preferredLoginURL;
    if (authenticatorType === AUTH_TYPE.SAML2) {
      (authID = decodeURIComponent(
        $.cordys.getURLParameter(window.location, 'authID')
      )),
        (currentOrganizationDN = getCurrentOrganizationDN());

      loginURL = $.cordys.authentication.defaults.ssoLoginURL;
    }
    if (preferredLoginURL) {
      loginURL = $.cordys.addURLParameter(
        preferredLoginURL,
        'language',
        getLanguage()
      ); // add browser language
      var path = encodeURIComponent(window.top.location.pathname);
      var search = encodeURIComponent(window.top.location.search);
      loginURL = $.cordys.addURLParameter(loginURL, 'path', path);
      loginURL = $.cordys.addURLParameter(loginURL, 'search', search);
      window.top.location.href = loginURL;
    } else if ($.mobile) {
      var pageFrom =
        $.mobile.activePage && $.mobile.activePage.attr('id')
          ? $.mobile.activePage.attr('id')
          : $("[data-role='page']").attr('id'),
        urlData = '';

      urlData = addUrlData(urlData, 'pageFrom', pageFrom); // add page from for redirection after login
      if (authenticatorType === AUTH_TYPE.SAML2) {
        urlData = addUrlData(urlData, 'organization', currentOrganizationDN); // add current user's organization dn
        urlData = addUrlData(urlData, 'language', getLanguage()); // add browser language
        urlData = addUrlData(urlData, 'authID', authID); // add authID
      }
      $.mobile.changePage($.cordys.addOrganizationContextToURL(loginURL), {
        transition: 'pop',
        changeHash: false,
        data: urlData,
      });

      // let us also close the page when login succeeds
      topLevelWindow.$Cordys_LoginDef.done(function () {
        closeLoginPage();
      });
    } else {
      if (authenticatorType === AUTH_TYPE.SAML2) {
        loginURL = $.cordys.addURLParameter(
          loginURL,
          'organization',
          currentOrganizationDN
        ); // add current user's organization dn
        loginURL = $.cordys.addURLParameter(loginURL, 'authID', authID); // add authID
      }
      loginURL = $.cordys.addURLParameter(loginURL, 'language', getLanguage()); // add browser language
      var windowObject = {
        window: window,
        dialogTitle: 'Process Platform Login',
      };
      window.showModalDialog(
        $.cordys.addOrganizationContextToURL(loginURL),
        windowObject
      ); //NOMBV
    }
  }

  // redirects to the saml2 logout gatway
  function showLogoutPage(logoutURL) {
    if ($.mobile) {
      $.mobile.changePage(logoutURL, { changeHash: false });
    } else {
      var windowObject = {
        window: window,
        dialogTitle: 'Process Platform Logout',
      };
      window.showModalDialog(logoutURL, windowObject); //NOMBV
    }
  }

  // close the login page
  function closeLoginPage() {
    var prevPage = $.cordys.getURLParameter(
      $.mobile.activePage.data('url'),
      'pageFrom'
    );
    $.mobile.changePage(prevPage ? $('#' + prevPage) : $.mobile.firstPage, {
      changeHash: false,
      reverse: true,
    });
  }

  // this method will return the current organization name of the user.
  // TODO - Replace the hard-coded /home/
  // TODO - Replace this with the new API provided by the Core Platform Team
  function getOrganizationName(organizationObjects) {
    var organizationName = $.cordys.getURLParameter(
      window.location,
      'organization'
    );
    if (organizationName) return organizationName; // return the organization name from the URL parameter.
    var pageURL = window.location.href;
    if (pageURL && pageURL.indexOf('home/') != -1) {
      pageURL = pageURL.substring(pageURL.indexOf('home/') + 5);
      // return the organization name from the page URL.
      return pageURL.substring(0, pageURL.indexOf('/'));
    }
    $.each(organizationObjects, function (i, value) {
      if (value['@default']) {
        organizationDN = value.dn;
        return false; // return back from each.
        // For getting the default organization DN.
      }
    });
    //returning the default organization name.
    return organizationDN.substring(
      organizationDN.indexOf('o=') + 2,
      organizationDN.indexOf(',')
    );
  }

  // prelogin error handler
  function preLoginErrorHandler(e, statusText, errorThrown) {
    var errorText =
      (e.responseXML && $(e.responseXML).find('MessageCode').text()) ||
      e.responseText ||
      errorThrown ||
      statusText,
      errorMessage = errorText;

    //When Cordys is down on server
    if (
      errorText == '<Error>SSO configuration not available</Error>' ||
      errorText ==
      'Cordys.WebGateway.Messages.WG_SOAPTransaction_SOAPNodeLookupFailure' ||
      errorText ==
      'Cordys.WebGateway.Messages.WG_SOAPTransaction_ReceiverDetailsInvalid' ||
      errorText == 'Cordys.WebGateway.Messages.CommunicationError'
    ) {
      errorMessage = 'SSO_UNAVAILABLE_ERROR';
    }

    //When there is no connectivity.
    else if (
      errorText == 'error' ||
      (navigator.network &&
        navigator.network.connection.type == Connection.NONE)
    ) {
      errorMessage = 'CONNECTION_FAILED_ERROR';
    }

    //Show notification when there is no organization. 'test' method is used for comparison because reponse has some special characters
    else if (
      /Exception occurred while handling the request. Check 'gateway.xml' for more details./.test(
        errorText
      )
    ) {
      //NOMBV
      errorMessage = 'ORGANIZATION_MISSING_ERROR';
    }
    $.cordys.showMessage(errorMessage, 'Login Failed');
  }

  // login error handler
  function loginErrorHandler(e, statusText, errorThrown) {
    var errorText =
      (e.responseXML && $(e.responseXML).find('MessageCode').text()) ||
      (e.responseText &&
        $(e.responseText).find('cordys\\:messagecode').text()) ||
      e.statusText ||
      errorThrown ||
      statusText,
      errorMessage = errorText;

    if (errorText == 'Cordys.ESBServer.Messages.invalidCredentials') {
      errorMessage = 'INVALID_CREDENTIALS_ERROR';
      $.cordys.showMessage(errorMessage, 'Invalid Credentials');
    } else if (errorText == 'Cordys.WebGateway.Messages.InvalidOrganization') {
      errorMessage = 'INVALID_ORGANIZATION_ERROR';
      $.cordys.showMessage(errorMessage, 'Invalid Organization');
    }
    //Show the actual error if we couldn't find the reason for the failure
    else {
      $.cordys.showMessage(errorText, 'Login Failed');
    }
  }

  // topLevelWindow.$Cordys_LoginDef is not garbage collected in IEs, so setting it as null while unloading the page.
  // Otherwise, IE will throw an exception as 'Can't execute code from a freed script'
  $(window).on('unload', function () {
    if (topLevelWindow && topLevelWindow === window) {
      topLevelWindow.$Cordys_LoginDef = null;
    }
  });
})(window, jQuery);
/**
 * Cordys Authentication Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  var renewTimerId;

  $.cordys.authentication.sso = {
    // api for authenticating with the credentials specified
    authenticate: function (userName, password) {
      $.cordys.authentication.setLoginStarted();

      var $authDeffered = $.Deferred();
      // set the login completed once authentication is done
      $authDeffered.done(function () {
        $.cordys.authentication.setLoginCompleted();
      });

      // Clear the cookies
      deleteAuthCookies()
        .done(function () {
          // Get the Prelogin Info
          $.cordys.authentication
            .getPreloginInfo()
            .done(function (preloginInfo) {
              // nothing is required in case of WebServer authentication
              if (preloginInfo.AuthConfigMode === 'WebServer') {
                console.log(
                  'This is a WebServer authentication. Hence, stopping the SSO login process '
                );
                $authDeffered.resolve();
                return;
              }
              setAuthContext(preloginInfo);
              // Get the SAML Assertions
              getSAMLAssertions(userName, password)
                .done(function (data) {
                  var artifact = $(data)
                    .find('AssertionArtifact, samlp\\:AssertionArtifact')
                    .text();
                  setSAMLAssertions(artifact);
                  renewSAMLAssertions(data);
                  $authDeffered.resolve();
                })
                .fail(function (e, statusText, errorThrown) {
                  $.cordys.authentication.defaults.loginErrorHandler(
                    e,
                    statusText,
                    errorThrown
                  );
                  //$.cordys.authentication.setLoginFailed();
                });
            })
            .fail(function () {
              AUTH_CONTEXT.cookies.ct.valid = false;
            });
        })
        .fail(function () {
          //TODO : Add failure callback for delete cookies
        });
      return $authDeffered.promise();
    },
    // return true if we have cookie
    isAuthenticated: function () {
      var ctCookie = $.cordys.getCookieObject('\\w*_ct').value; //NOMBV
      return !(ctCookie === '' || ctCookie === undefined || ctCookie === null);
    },
    //initialize authentication with the given artifact
    initializeSessionFromArtifact: function (samlArt) {
      $.cordys.authentication
        .getPreloginInfo({ async: false })
        .done(function (preloginInfo) {
          samlArt = samlArt
            ? samlArt
            : $.cordys.getCookieObject(preloginInfo.SamlArtifactCookieName.text)
              .value; //NOMBV(2)
          if (!samlArt) return;
          setAuthContext(preloginInfo);
          setSAMLAssertions(samlArt);
          // Start the renew process if renew is not started yet
          if (!renewTimerId) {
            // Get the userName and expiry details to start the renew process
            var nameIdentifierRequest = getNameIdentifierRequest(samlArt);
            $.ajax(nameIdentifierRequest).done(function (
              nameIdentifierResponse
            ) {
              renewSAMLAssertions(nameIdentifierResponse);
            });
          }
        });
    },
    // Clear the assertions and the renew timer
    clearAssertions: function (preloginInfo) {
      clearRenewAssertionTimer();
      var authenticatorType = preloginInfo.Authenticator.Type;
      if (authenticatorType === 'cordys') {
        var cookiePath = preloginInfo.SamlArtifactCookiePath.text || '/'; //NOMBV
        $.cordys.deleteAllCookies(cookiePath);
      }
    },
  };

  $.cordys.authentication.sso.defaults = {
    loginGatewayURL: 'com.eibus.web.soap.Gateway.wcp',
  };

  var AUTH_CONTEXT = {
    cookies: {
      ct: {
        name: null,
        value: null,
        valid: false,
      },
      saml: {
        name: null,
        value: null,
        time: null,
        valid: false,
      },
      path: '/',
    },
    url: null,
  };

  // clear the renew assertion timer if running
  function clearRenewAssertionTimer() {
    if (renewTimerId) {
      clearTimeout(renewTimerId);
    }
  }

  // get the saml assertions using the login method
  function getSAMLAssertions(userName, password) {
    var deferred = $.Deferred(),
      login = getLoginRequest(userName, password);

    $.ajax(login)
      .done(function (data) {
        var artifact = $(data)
          .find('AssertionArtifact, samlp\\:AssertionArtifact')
          .text();

        if (!artifact) {
          deferred.reject();
          return deferred.promise();
        }
        deferred.resolve(data);
      })
      .fail(function (e, statusText, errorThrown) {
        AUTH_CONTEXT.cookies.saml.valid = false;
        deferred.reject(e, statusText, errorThrown);
      });

    return deferred.promise();
  }

  // get the login request
  function getLoginRequest(userName, password) {
    return {
      data: getLoginRequestXML(userName, password),
      contentType: 'text/xml; charset="utf-8"',
      type: 'POST',
      dataType: 'xml',
      url: $.cordys.authentication.sso.defaults.loginGatewayURL,
      cache: false,
      headers: { 'cache-control': 'no-cache' },
    };
  }

  // get requestXML for login
  function getLoginRequestXML(userName, password) {
    return (
      '<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<SOAP:Header>' +
      '<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
      '<wsse:UsernameToken xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
      '<wsse:Username>' +
      userName +
      '</wsse:Username>' +
      '<wsse:Password>' +
      password +
      '</wsse:Password>' +
      '</wsse:UsernameToken>' +
      '</wsse:Security>' +
      '</SOAP:Header>' +
      '<SOAP:Body>' +
      '<samlp:Request xmlns:samlp="urn:oasis:names:tc:SAML:1.0:protocol" MajorVersion="1" MinorVersion="1" IssueInstant="2012-02-28T18:53:10Z" RequestID="a2bcd8ab5a-342b-d320-aa89-c3de380cd13">' +
      '<samlp:AuthenticationQuery>' +
      '<saml:Subject xmlns:saml="urn:oasis:names:tc:SAML:1.0:assertion">' +
      '<saml:NameIdentifier Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">' +
      userName +
      '</saml:NameIdentifier>' +
      '</saml:Subject>' +
      '</samlp:AuthenticationQuery>' +
      '</samlp:Request>' +
      '</SOAP:Body>' +
      '</SOAP:Envelope>'
    );
  }

  // Renew the SAML assertion before it expires
  function renewSAMLAssertions(loginResponse) {
    // Get the details to renew the assertions
    var userName = $(loginResponse)
      .find('AssertionArtifact, saml\\:NameIdentifier')
      .text(),
      issueInstant = $(loginResponse)
        .find('AssertionArtifact, samlp\\:Response')
        .attr('IssueInstant'),
      notOnOrAfter = $(loginResponse)
        .find('AssertionArtifact, saml\\:Conditions')
        .attr('NotOnOrAfter'),
      preExpirationRefreshPeriodMs = 300000, // 5 minutes = 5 * 60 * 1000
      minimalPeriodMs = 10000, // 10 seconds
      expirationPeriodMs;

    // actual expiry time - preExpiry time
    expirationPeriodMs =
      new Date(notOnOrAfter).getTime() -
      new Date(issueInstant).getTime() -
      preExpirationRefreshPeriodMs;

    // Clear the renew timer
    clearRenewAssertionTimer();

    // Start the renew assertion timer
    renewTimerId = window.setTimeout(
      function () {
        var renewRequest = getRenewRequest(userName);
        $.ajax(renewRequest).done(function (renewResponse) {
          var artifact = $(renewResponse)
            .find('AssertionArtifact, samlp\\:AssertionArtifact')
            .text();
          // Set the latest artifact to renew session
          setSAMLAssertions(artifact);
          renewSAMLAssertions(renewResponse);
        });
      },
      expirationPeriodMs > minimalPeriodMs
        ? expirationPeriodMs
        : minimalPeriodMs
    );
  }

  // Get the username and expiry details for renewing the assertion
  function getNameIdentifierRequest(samlArt) {
    return {
      data: getNameIdentifierRequestXML(samlArt),
      contentType: 'text/xml; charset="utf-8"',
      type: 'POST',
      dataType: 'xml',
      url: getGatewayURL(),
      cache: false,
      headers: { 'cache-control': 'no-cache' },
    };
  }

  // get Name Identifier Request XML
  function getNameIdentifierRequestXML(samlArt) {
    return (
      '<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<SOAP:Header>' +
      '</SOAP:Header>' +
      '<SOAP:Body>' +
      '<samlp:Request xmlns:samlp="urn:oasis:names:tc:SAML:1.0:protocol" MajorVersion="1" MinorVersion="1" IssueInstant="2013-06-17T11:16:38Z" RequestID="a62d2508b9-b88e-b790-e41b-16b3ed3cc4c">' +
      '<samlp:AssertionArtifact xmlns:samlp="urn:oasis:names:tc:SAML:1.0:protocol">' +
      samlArt +
      '</samlp:AssertionArtifact>' +
      '</samlp:Request>' +
      '</SOAP:Body>' +
      '</SOAP:Envelope>'
    );
  }

  function getRenewRequest(userName) {
    return {
      data: getRenewRequestXML(userName),
      contentType: 'text/xml; charset="utf-8"',
      type: 'POST',
      dataType: 'xml',
      url: getGatewayURL(),
      cache: false,
      headers: { 'cache-control': 'no-cache' },
    };
  }

  // get renew request XML for renew request
  function getRenewRequestXML(userName) {
    return (
      '<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<SOAP:Header>' +
      '</SOAP:Header>' +
      '<SOAP:Body>' +
      '<samlp:Request xmlns:samlp="urn:oasis:names:tc:SAML:1.0:protocol" MajorVersion="1" MinorVersion="1" IssueInstant="2013-06-14T11:25:34Z" RequestID="a71b2d2cc3-cc5b-d45c-39dd-87c5cb708b2">' +
      '<samlp:AuthenticationQuery>' +
      '<saml:Subject xmlns:saml="urn:oasis:names:tc:SAML:1.0:assertion">' +
      '<saml:NameIdentifier Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">' +
      userName +
      '</saml:NameIdentifier>' +
      '</saml:Subject>' +
      '</samlp:AuthenticationQuery>' +
      '</samlp:Request>' +
      '</SOAP:Body>' +
      '</SOAP:Envelope>'
    );
  }

  // Get the request gateway URL with ct
  function getGatewayURL() {
    var url = $.cordys.authentication.sso.defaults.loginGatewayURL,
      ctCookie = $.cordys.getCookieObject('\\w*_ct');

    // Add the ct name in the request URL
    if (ctCookie.value) {
      //NOMBV
      url = $.cordys.addURLParameter(url, ctCookie.key, ctCookie.value); //NOMBV
    }
    return url;
  }

  // delete the authentication cookies
  function deleteAuthCookies() {
    var deferred = $.Deferred();

    // delete all the cookies
    $.cordys.deleteAllCookies(AUTH_CONTEXT.cookies.path);

    deferred.resolve();
    return deferred.promise();
  }

  // set auth context for cookies using prelogin info
  function setAuthContext(preloginInfo) {
    AUTH_CONTEXT.cookies.saml.name = preloginInfo.SamlArtifactCookieName.text; //NOMBV
    AUTH_CONTEXT.cookies.ct.name = preloginInfo.CheckName.text; //NOMBV
    AUTH_CONTEXT.cookies.ct.valid = true;
    AUTH_CONTEXT.cookies.path = preloginInfo.SamlArtifactCookiePath.text || '/'; //NOMBV
  }

  // set the SAML assertion in AUTH_CONTEXT and in Cookies
  function setSAMLAssertions(artifact) {
    AUTH_CONTEXT.cookies.saml.value = artifact; //NOMBV
    AUTH_CONTEXT.cookies.saml.valid = true;
    setCookies();
  }

  // set the saml values in cookies
  function setCookies() {
    var __cordysSAMLArtCookieName = AUTH_CONTEXT.cookies.saml.name,
      __cordysSAMLArtCookieValue = AUTH_CONTEXT.cookies.saml.value, //NOMBV
      __cordysCookiePath = AUTH_CONTEXT.cookies.path;

    document.cookie =
      __cordysSAMLArtCookieName +
      '=' +
      __cordysSAMLArtCookieValue +
      '; path=' +
      __cordysCookiePath;
    if (__cordysSAMLArtCookieName) {
      if (typeof hex_sha1 === 'undefined') {
        $.cordys.loadScript('/cordys/thirdparty/sha1/sha1.js', function () {
          setCtCookies(__cordysSAMLArtCookieValue);
        });
      } else setCtCookies(__cordysSAMLArtCookieValue);
    }
  }
  //sGenerate and sets the ct value in cookies
  function setCtCookies(SAMLArtCookieValue) {
    var ct = hex_sha1(SAMLArtCookieValue);
    document.cookie =
      AUTH_CONTEXT.cookies.ct.name +
      '=' +
      ct +
      '; path=' +
      AUTH_CONTEXT.cookies.path;
  }

  // Useful to avoid extra round-trips, if smal-art-cookie is already avilable
  $.cordys.authentication.sso.initializeSessionFromArtifact();
})(window, jQuery);
/**
 * Cordys Binding that needs to implemented by the binding handlers
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  $.cordys.binding = function () {
    var self = this;

    // Should return whether this binding is read-only. Returns true by default
    this.isReadOnly = function () {
      return true;
    };

    // Should return the number of records. Has to implemented by the binding handler.
    this.getSize = function () {
      $.error("Method 'getSize' should be implemented by the binding handler");
    };

    // Clear all the objects from the collection. Has to implemented by the binding handler.
    this.clear = function () {
      $.error("Method 'clear' should be implemented by the binding handler");
    };

    // Returns the binding object for the corresponding JS Object. Has to implemented by the binding handler.
    this.getBindingObject = function (jsObject) {
      $.error(
        "Method 'getBindingObject' should be implemented by the binding handler"
      );
    };

    // Add a set of binding objects to the collection
    this.addBindingObjects = function (bindingObjects) {
      $.error(
        "Method 'addBindingObjects' should be implemented by the binding handler"
      );
    };

    // Get the JS Object for the binding object. Has to implemented by the binding handler if it is not readOnly.
    this.getJSObject = function (bindingObject) {
      $.error(
        "Method 'getJSObject' should be implemented by the binding handler"
      );
    };

    // Get the initial state (JS Object for which the binding object was created). Has to implemented by the binding handler if it is not readOnly.
    this.getInitialState = function (bindingobject) {
      $.error(
        "Method 'getInitialState' should be implemented by the binding handler"
      );
    };

    // Returns true if the specified bindingObect is a newly inserted object. Has to implemented by the binding handler if it is not readOnly.
    this.isInsertedObject = function (bindingObject) {
      $.error(
        "Method 'isInsertedObject' should be implemented by the binding handler"
      );
    };

    // Returns true if the specified bindingObect is dirty. Has to implemented by the binding handler if it is not readOnly.
    this.isUpdatedObject = function (bindingObject) {
      $.error(
        "Method 'isUpdatedObject' should be implemented by the binding handler"
      );
    };

    // Returns true if the specified bindingObect is marked for deletion. Has to implemented by the binding handler if it is not readOnly.
    this.isDeletedObject = function (bindingObject) {
      $.error(
        "Method 'isDeletedObject' should be implemented by the binding handler"
      );
    };

    // Insert the binding object into the collection. Has to implemented by the binding handler if it is not readOnly.
    this.insertObject = function (jsObject) {
      $.error(
        "Method 'insertObject' should be implemented by the binding handler"
      );
    };

    // Update the binding object. Has to implemented by the binding handler if it is not readOnly.
    this.updateObject = function (jsObject) {
      $.error(
        "Method 'updateObject' should be implemented by the binding handler"
      );
    };

    // Mark the binding object for deletion. Has to implemented by the binding handler if it is not readOnly.
    this.removeObject = function (jsObject) {
      $.error(
        "Method 'removeObject' should be implemented by the binding handler"
      );
    };

    // Revert changes to the Object. Revert to initial state if dirty, deleted if newly inserted and remove if there are any deletion flags
    this.revertObject = function (bindingObject) {
      $.error(
        "Method 'revertObject' should be implemented by the binding handler"
      );
    };

    // Synchronize the state state of the binding object to the current state in the backend (specified jsObject). If the jsObject is not specified, the object needs
    // to be deleted
    this.synchronizeObject = function (bindingObject, jsObject) {
      $.error(
        "Method 'synchronizeObject' should be implemented by the binding handler"
      );
    };

    // Bind the set of bindingObjects to the context. Has to implemented by the binding handler if it is not readOnly.
    this.bindObjects = function (context, bindingObjects) {
      $.error(
        "Method 'bindObjects' should be implemented by the binding handler"
      );
    };
  };
})(window, jQuery);
/**
 * Cordys JSRender Binding Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  // TODO Check if JSRender is loaded

  $.cordys.binding.jsrender = function (model, settings) {
    var self = this;
    var objects = [];

    // Returns the binding object for the corresponding JS Object
    this.getBindingObject = function (jsObject) {
      return jsObject;
    };

    // Clear all the objects from the collection
    this.clear = function () {
      objects = [];
    };

    // Returns the number of Business Objects
    this.getSize = function () {
      return objects.length;
    };

    this.getObjects = function () {
      return objects;
    };

    // Add a set of binding objects to the collection
    this.addBindingObjects = function (bindingObjects) {
      objects = bindingObjects;
      model[model.objectName] = objects;
    };

    this.bindObjects = function (context, bindingObjects) {
      if (!settings.binding.template) {
        return console.log('Binding Template not specified');
      }
      var html = settings.binding.template.render(bindingObjects);
      context.html(html).listview('refresh');
    };
  };
})(window, jQuery);
/**
 * Cordys KO Binding Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  $.cordys.binding.knockout = function (model, settings) {
    var self = this;

    // add knockoutJS and the mapping plugin if the model is not readOnly
    if (typeof ko === 'undefined') {
      $.cordys.loadScript(
        $.cordys.addOrganizationContextToURL(
          '/cordys/thirdparty/knockout/knockout.js'
        )
      );
    }
    if (typeof ko.mapping === 'undefined') {
      $.cordys.loadScript(
        $.cordys.addOrganizationContextToURL(
          '/cordys/thirdparty/knockout/knockout.mapping.js'
        )
      );
    }

    var opts = $.extend({}, settings);

    // Take care of the mapping options
    opts.mappingOptions = opts.mappingOptions || {};
    opts.mappingOptions.ignore = opts.mappingOptions.ignore || [];
    opts.mappingOptions.ignore.push('_destroy');

    var includePersistedFields = function (fields, context) {
      $.each(fields, function (i, f) {
        var fName = typeof f === 'string' ? f : f.name;
        var fullFName = context ? context + '.' + fName : fName;
        var persisted =
          typeof f.persisted !== 'undefined'
            ? f.persisted
            : typeof f === 'string' || !(f.computed || f.path);
        if (persisted) {
          opts.mappingOptions.include.push(fullFName);
        } else {
          opts.mappingOptions.ignore.push(fullFName);
        }
        if (f.fields) {
          includePersistedFields(f.fields, fullFName);
        }
      });
    };

    if (opts.fields) {
      opts.mappingOptions.include = opts.mappingOptions.include || [];
      includePersistedFields(opts.fields, undefined);
    }

    // make the object collection observable
    var bindingObjects = (model[model.objectName] = ko.observableArray());
    model.selectedItem = ko.observable();
    // bind automatically if the context is set
    if (typeof opts.context !== 'undefined') {
      ko.applyBindings(model, opts.context);
    }

    this.isReadOnly = function () {
      return false;
    };

    // Returns the number of Business Objects
    this.getSize = function () {
      return typeof bindingObjects === 'function'
        ? bindingObjects().length
        : bindingObjects.length;
    };

    // Returns the binding object for the corresponding JS Object
    this.getBindingObject = function (jsObject) {
      var observableObject = mapObject(
        jsObject,
        null,
        opts.fields,
        opts.mappingOptions,
        model.isReadOnly
      );
      if (!model.isReadOnly) {
        addOptimisticLock(model, opts, jsObject, observableObject, false);
      }
      return observableObject;
    };

    this.getJSObject = function (bindingObject) {
      return ko.mapping.toJS(bindingObject);
    };

    this.synchronizeObject = function (bindingObject, jsObject) {
      if (!jsObject) {
        // delete the object
        bindingObjects.remove(bindingObject);
      } else if (bindingObject.lock && bindingObject.lock.isDirty()) {
        // set the lock to the latest state of the object
        bindingObject.lock._update(jsObject);
      } else if (!bindingObject.lock) {
        // the inserted object is synced, so let us add the lock
        addOptimisticLock(self, opts, jsObject, bindingObject, false);

        // update the object with what we got from the backend
        bindingObject.lock._update(jsObject);
      }
    };

    this.bindObjects = function (context, objects) {
      // In KO applyBindings multiple times creates issues. So done only in startup
    };

    // Clear all the objects from the collection
    this.clear = function () {
      if (this.getSize() > 0) {
        bindingObjects.removeAll();
      }
    };

    // Adds the specified Business Object
    this.insertObject = function (object) {
      if (!object) return null;
      if (!ko.isObservable(object)) {
        object = mapObject(
          object,
          null,
          opts.fields,
          opts.mappingOptions,
          model.isReadOnly
        );
      }
      bindingObjects.push(object);
      return object;
    };

    this.getInitialState = function (bindingobject) {
      return bindingobject.lock.getInitialState();
    };

    // Removes the specified Business Object
    this.removeObject = function (object) {
      if (!object) return null;
      if (typeof model[model.objectName] !== 'function') {
        // in case of no knockout
        return null;
      }
      if (!object.lock) {
        // removing object not yet persisted. so let us just remove it
        model[model.objectName].remove(object);
      } else {
        // otherwise we just mark it with the KO destroy flag
        model[model.objectName].destroy(object);
      }
      return object;
    };

    this.revertObject = function (object) {
      if (!object.lock) {
        // remove newly inserted objects
        model[model.objectName].remove(object);
      } else {
        // revert the changed objects
        if (object.lock.isDirty()) {
          object.lock.undo();
        }
        // also unmark ones for deletion. Remember that changed ones could have also been marked for deletion
        if (object._destroy === true) {
          object.lock._undestroy();
        }
      }
    };

    this.isInsertedObject = function (object) {
      return !object.lock && object._destroy !== true;
    };

    this.isUpdatedObject = function (object) {
      return object.lock && object.lock.isDirty();
    };

    this.isDeletedObject = function (object) {
      return object.lock && object._destroy === true;
    };

    // Return the collection of objects
    this.getObjects = function () {
      return bindingObjects();
    };

    // Add a set of binding objects to the collection
    this.addBindingObjects = function (objects) {
      return bindingObjects(objects);
    };
  };
  // Maps a JS object into an observable
  var mapObject = function (
    dataObject,
    existingObservable,
    fields,
    mappingOptions,
    isReadOnly
  ) {
    var mappedObject = isReadOnly
      ? dataObject
      : existingObservable
        ? ko.mapping.fromJS(dataObject, mappingOptions, existingObservable)
        : ko.mapping.fromJS(dataObject, mappingOptions);
    if (fields) {
      mappedObject = mapObjectByFields(
        dataObject,
        mappedObject,
        fields,
        null,
        !isReadOnly,
        existingObservable
      );
    }
    return mappedObject;
  };

  // Create bindingObjects from a data object against fields, supporting child objects, arrays, compute, paths and others.
  var mapObjectByFields = function (
    dataObject,
    mappedObject,
    objectFields,
    rootObject,
    createObservables,
    existingObservable
  ) {
    if (!rootObject) rootObject = dataObject;

    $.each(objectFields, function (i, f) {
      if (typeof f === 'string') {
        if (!mappedObject[f]) {
          mappedObject[f] = createObservables ? ko.observable() : undefined; // add the field if it is not there, to avoid ko "Unable to parse binding" error
        } else if (!dataObject[f]) {
          createObservables
            ? mappedObject[f](undefined)
            : (mappedObject[f] = undefined);
        }
      } else {
        if (!f.name) throw new Error("Mandatory property 'name' not specified");
        var value = ko.utils.unwrapObservable(mappedObject[f.name]);
        if (value === undefined) {
          value = f.defaultValue;
        }

        if (f.path) {
          // get the value from the dataObject via the specified path
          var spath = f.path.split('.');
          value = dataObject;
          for (var i = 0; i < spath.length; i++) {
            if (typeof value == 'undefined') break;
            value =
              spath[i] == '$root'
                ? rootObject
                : ko.utils.unwrapObservable(value[spath[i]]);
          }
        }
        if (f.computed) {
          // create a knockout computed object to get the value
          if (!ko.isComputed(mappedObject[f.name])) {
            mappedObject[f.name] = ko.computed(f.computed, mappedObject);
          }
          return mappedObject;
        }
        if (f.isArray) {
          if (value) {
            if (!$.isArray(value)) {
              // wrap the value into an array
              value = [value];
            }
          } else {
            // create an empty array
            value = [];
          }
          if ($.isArray(mappedObject[f.name])) {
            createObservables
              ? mappedObject[f.name](value)
              : (mappedObject[f.name] = value);
          } else {
            mappedObject[f.name] = createObservables
              ? ko.observableArray(value)
              : value;
          }
        } else {
          if ((!mappedObject[f.name] || f.path) && !f.fields) {
            if (mappedObject[f.name]) {
              createObservables
                ? mappedObject[f.name](value)
                : (mappedObject[f.name] = value);
            } else {
              mappedObject[f.name] = createObservables
                ? ko.observable(value)
                : value;
            }
          }
          if (f.fields) {
            mappedObject[f.name] = value || {};
          }
        }
        if (f.fields) {
          // recursively map child objects
          mappedObject[f.name] = mappedObject[f.name] || value || {};
          if ($.isArray(value)) {
            var arrayObject = ko.isObservable(mappedObject[f.name])
              ? mappedObject[f.name]()
              : mappedObject[f.name];
            for (var i = 0; i < value.length; i++) {
              mapObjectByFields(
                value[i],
                arrayObject[i],
                f.fields,
                rootObject,
                createObservables
              );
            }
          } else {
            mapObjectByFields(
              value,
              mappedObject[f.name],
              f.fields,
              rootObject,
              createObservables
            );
          }
        }
      }
    });

    return mappedObject;
  };

  // Adds lock. This stores the initial state, so that you can identify objects that are changes as well as know their old values
  var addOptimisticLock = function (
    model,
    opts,
    data,
    observableData,
    isInitiallyDirty
  ) {
    var result = function () { };
    var _initialState = data;
    var _initialJSONString = ko.mapping.toJSON(observableData);
    var _isInitiallyDirty = ko.observable(isInitiallyDirty);

    // Gets initial state of the objects
    result.getInitialState = function () {
      return _initialState;
    };

    // Returns if the object is changed
    result.isDirty = function () {
      return (
        observableData &&
        (_isInitiallyDirty() ||
          _initialJSONString !== ko.mapping.toJSON(observableData))
      );
    };

    // Strictly to be used internally. Updates the lock(the initial state) to the current state of the object
    result._updateLock = function (data) {
      _initialState = data ? data : ko.mapping.toJS(observableData);
      _initialJSONString = ko.mapping.toJSON(observableData);
      _isInitiallyDirty(false);
    };

    // Strictly to be used internally. Updates the current state and the lock after successful update/insert
    result._update = function (newData) {
      mapObject(
        newData,
        observableData,
        opts.fields,
        opts.mappingOptions,
        false
      );
      this._updateLock(newData);
    };

    // Used internally for unmarking objects marked for deleteion
    result._undestroy = function () {
      // KO Observable array does not have a undestroy, so let us just remove the destroy flag after a change notification
      model[model.objectName].valueWillMutate();
      delete observableData._destroy;
      model[model.objectName].valueHasMutated();
    };

    // Sets the object back to the initial state
    result.undo = function () {
      if (this.isDirty()) {
        this._update(_initialState);
      }
    };
    observableData.lock = result;
    return result;
  };
})(window, jQuery);
/**
 * Cordys Case Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  if (!$.cordys) {
    throw new Error(
      'The Cordys HTML5 SDK is required, please ensure it is loaded properly'
    );
  }

  $.cordys['case'] = new (function () {
    var self = this;

    this.createCase = function (caseModel, caseVariables, caseData, options) {
      if (caseVariables) {
        caseData = caseData || { data: {} };
        if (caseData.data.constructor !== Array) {
          caseData.data = [caseData.data];
        }
        caseData.data.push(getCaseVariablesData(caseVariables));
      }
      options = getOptionsForCaseMethod('CreateCase', options, {
        model: caseModel,
        casedata: caseData,
      });
      return $.cordys.ajax(options);
    };

    this.getActivityDefinition = function (caseInstance, activities, options) {
      options = getOptionsForCaseMethod('GetActivityDefinition', options);
      options.parameters = options.parameters || {};
      $.extend(options.parameters, {
        caseinstanceid: getCaseInstanceId(caseInstance),
        activities: { activityid: activities },
      });
      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'case:activity');
      });
    };

    this.getActivityInstance = function (
      caseInstance,
      activityInstanceId,
      options
    ) {
      options = getOptionsForCaseMethod('GetActivityInstance', options);
      options.parameters = options.parameters || {};
      $.extend(options.parameters, {
        caseinstanceid: getCaseInstanceId(caseInstance),
        activityinstanceid: activityInstanceId,
      });

      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.find(response, 'ACTIVITY_INSTANCE');
      });
    };

    this.getActivityInstances = function (caseInstance, options) {
      options = getOptionsForCaseMethod('GetActivityInstances', options);
      options.parameters = options.parameters || {};
      $.extend(options.parameters, {
        caseinstanceid: getCaseInstanceId(caseInstance),
      });

      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'ACTIVITY_INSTANCE');
      });
    };

    this.getBusinessEvents = function (caseInstance, activityId, options) {
      options = getOptionsForCaseMethod('GetBusinessEvents', options);
      options.parameters = options.parameters || {};
      options.parameters.caseinstanceid = getCaseInstanceId(caseInstance);
      options.parameters.activityid = activityId;

      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'case:event');
      });
    };

    this.getCaseInstance = function (caseInstance, options) {
      options = getOptionsForCaseMethod('GetCaseInstance', options);
      options.parameters = options.parameters || {};
      options.parameters.caseinstanceid = getCaseInstanceId(caseInstance);

      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.find(response, 'CASE_INSTANCE');
      });
    };

    this.getCaseData = function (caseInstance, options) {
      options = getOptionsForCaseMethod('GetCaseData', options);
      options.parameters = options.parameters || {};
      options.parameters.caseinstanceid = getCaseInstanceId(caseInstance);

      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.find(response, 'casedata');
      });
    };

    this.getCaseVariables = function (caseInstance, options) {
      options = getOptionsForCaseMethod('GetCaseVariables', options);
      options.parameters = options.parameters || {};
      options.parameters.caseinstanceid = getCaseInstanceId(caseInstance);

      return $.cordys.ajax(options).then(function (response) {
        var casedata = $.cordys.json.find(response, 'casedata');
        // Get the case variables as an array of the variables, removing the case prefix.
        var vars = casedata.data['case:casevariables'],
          variables = {};
        for (var v in vars) {
          if (typeof vars[v] === 'object') {
            variables[v.replace(/^[^:]*:/, '')] = vars[v];
          }
        }
        casedata.data = { casevariables: variables };
        return casedata;
      });
    };

    this.getFollowupActivities = function (caseInstance, activityid, options) {
      options = getOptionsForCaseMethod('GetFollowupActivities', options);
      options.parameters = options.parameters || {};
      options.parameters.caseinstanceid = getCaseInstanceId(caseInstance);
      options.parameters.activityid = activityid;

      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'case:followup');
      });
    };

    this.planActivities = function (caseInstance, activities, options) {
      options = getOptionsForCaseMethod('PlanActivities', options, {
        caseinstanceid: getCaseInstanceId(caseInstance),
        planactivities: { activity: activities },
      });
      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'state');
      });
    };

    this.planIntermediateActivities = function (
      caseInstance,
      activityInstanceId,
      activityId,
      activities,
      options
    ) {
      options = getOptionsForCaseMethod('PlanIntermediateActivities', options, {
        caseinstanceid: getCaseInstanceId(caseInstance),
        activityinstanceid: {
          '@activityid': activityId,
          text: activityInstanceId,
        },
        planactivities: { activity: activities },
      });
      return $.cordys.ajax(options);
    };

    this.sendEvent = function (caseInstance, eventName, sourceId, options) {
      options = getOptionsForCaseMethod('SendEvent', options, {
        caseinstanceid: getCaseInstanceId(caseInstance),
        event: {
          text: eventName,
          '@source': sourceId,
        },
      });
      return $.cordys.ajax(options);
    };

    this.updateCaseData = function (caseInstance, caseData, options) {
      options = getOptionsForCaseMethod('UpdateCaseData', options, {
        caseinstanceid: getCaseInstanceId(caseInstance),
        casedata: caseData,
      });
      return $.cordys.ajax(options);
    };

    this.updateCaseVariables = function (
      caseInstance,
      caseVariables,
      lockid,
      options
    ) {
      options = getOptionsForCaseMethod('UpdateCaseVariables', options, {
        caseinstanceid: getCaseInstanceId(caseInstance),
        casedata: {
          '@lockID': lockid,
          data: getCaseVariablesData(caseVariables),
        },
      });
      return $.cordys.ajax(options);
    };
    return this;
  })();

  function getOptionsForCaseMethod(
    methodName,
    options,
    defaultParameters,
    namespace
  ) {
    options = options || {};
    var ajaxOptions = $.extend(
      {
        method: methodName,
        namespace:
          namespace || 'http://schemas.cordys.com/casemanagement/execution/1.0',
      },
      options
    );
    ajaxOptions.parameters = $.extend(defaultParameters, options.parameters);
    return ajaxOptions;
  }

  function getCaseInstanceId(caseInstance) {
    var id =
      typeof caseInstance === 'object'
        ? caseInstance.ProcessInstanceId ||
        caseInstance.CaseInstanceId ||
        caseInstance.caseinstanceid
        : caseInstance;
    // If it is an observable, call the method to get the value, otherwise just return the value
    return typeof id === 'function' ? id() : id;
  }

  function getCaseVariablesData(caseVars) {
    var returnData = {
      '@xmlns:case': 'http://schemas.cordys.com/casemanagement/1.0',
      '@name': 'case:casevariables',
      'case:casevariables': {},
    };
    for (var vName in caseVars) {
      var newName = vName.indexOf('case:') !== 0 ? 'case:' + vName : vName;
      returnData['case:casevariables'][newName] = caseVars[vName];
    }
    return returnData;
  }
})(window, jQuery);
/**
 * Cordys P-Model Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  if (!$.cordys) $.cordys = {};
  if (!$.cordys.ajax)
    $.cordys.loadScript(
      $.cordys.addOrganizationContextToURL(
        '/cordys/html5/plugins/cordys.ajax.js'
      )
    );
  if (!$.cordys.binding)
    $.cordys.loadScript(
      $.cordys.addOrganizationContextToURL(
        '/cordys/html5/plugins/cordys.binding.js'
      )
    );

  $.cordys.model = function (settings) {
    var self = this;
    var opts = $.extend({}, $.cordys.model.defaults, settings);
    this.objectName = settings.objectName;

    // set read-only - take readonly if set in opts, otherwise we see if one of the change settings is specified and then default to the model.defaults
    this.isReadOnly = settings.hasOwnProperty('isReadOnly')
      ? settings.isReadOnly === true
      : typeof (settings.create || settings.update || settings['delete']) ===
        'undefined'
        ? $.cordys.model.defaults.isReadOnly
        : false;

    // throw an error or write to the console if a handler is specified but is not available (mostly since the script was not loaded)
    if (
      opts.binding &&
      opts.binding.hasOwnProperty('handler') &&
      !opts.binding.handler
    ) {
      $.error(
        'The model binding handler specified in the binding options is not available'
      );
    }

    // get the binding handler implementation. Default to knockout for backwards compatibility
    var bindingHandlerClass =
      (opts.binding && opts.binding.handler) || $.cordys.binding.knockout;

    // get the default methods so that we do not have to check each time
    bindingHandlerClass.prototype = new $.cordys.binding();

    // create the binding handler
    var bindingHandler = new bindingHandlerClass(self, opts);

    if (!this.isReadOnly && bindingHandler.isReadOnly()) {
      $.error(
        'The model binding handler is readonly and does not support CRUD operations'
      );
    }

    // Returns the binding handler
    this.getBindingHandler = function () {
      return bindingHandler;
    };

    // Sends the get/read request
    this.read = function (readSettings) {
      var readOptions = $.extend(
        true,
        {},
        settings.defaults,
        settings.read,
        readSettings
      );
      readOptions._$Def = $.Deferred();
      readOptions.context = readOptions;

      $.cordys
        .ajax(readOptions)
        .done(function (data) {
          if (opts.useTupleProtocol) {
            var tuples = getObjects(data, 'tuple');
            var objects = $.map(tuples, function (tuple, index) {
              var object = tuple['new']
                ? tuple['new'][self.objectName]
                : tuple.old[self.objectName];
              object.getTuple = function () {
                return tuple;
              };
              return object;
            });
          } else {
            var objects = getObjects(data, self.objectName);
          }
          // store the cursor details
          handleCursorAfterRead(data, objects.length);
          objects = self.putData(objects);

          this._$Def.resolve(objects, this);
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
          this._$Def.reject(jqXHR, textStatus, errorThrown, this);
        });
      return readOptions._$Def.promise();
    };

    this.putData = function (data) {
      var objects = $.isArray(data) ? data : getObjects(data, self.objectName);
      if (objects.length == 0 && typeof data === 'object')
        objects = data.length ? [data] : [];
      if (objects.length > 0) {
        for (var objectKey in objects) {
          var object = objects[objectKey],
            bindingObject = bindingHandler.getBindingObject(object);
          objects[objectKey] = bindingObject;
        }

        this.clear();
        bindingHandler.addBindingObjects(objects);
        //self[self.objectName] = bindingHandler.getObjects();
        bindingHandler.bindObjects(opts.context, objects);
      }
      return objects;
    };

    // Returns the number of Business Objects
    this.getSize = function () {
      return bindingHandler.getSize();
    };

    // Empties the model
    this.clear = function () {
      bindingHandler.clear();
    };

    // Adds the specified Business Object
    this.addBusinessObject = function (object) {
      return bindingHandler.insertObject(object);
    };

    // Removes the specified Business Object
    this.removeBusinessObject = function (object) {
      return bindingHandler.removeObject(object);
    };

    // Reverts all local changes
    this.revert = function (objectToRevert) {
      if (typeof objectToRevert !== 'undefined') {
        bindingHandler.revertObject(objectToRevert);
      } else {
        var objects = bindingHandler.getObjects();
        for (var objectKey in objects) {
          var object = objects[objectKey];
          bindingHandler.revertObject(object);
        }
      }
    };

    // Gets the next set of records
    this.getNextPage = function (nextPageSettings) {
      if (self.cursor) {
        nextPageSettings = $.extend(true, {}, nextPageSettings, {
          parameters: { cursor: self.cursor },
        });
      }
      return this.read(nextPageSettings);
    };

    // Gets the previous set of records
    this.getPreviousPage = function (previousPageSettings) {
      if (self.cursor) {
        var previousPosition =
          self.cursor['@position'] - self.cursor['@numRows'] * 2;
        self.cursor['@position'] = previousPosition < 0 ? 0 : previousPosition;
        previousPageSettings = $.extend(true, {}, previousPageSettings, {
          parameters: { cursor: self.cursor },
        });
      }
      return this.read(previousPageSettings);
    };

    // Returns true if there are more records to move forward in the cursor
    this.hasNext = function () {
      if (this.getSize() === 0) return false;
      if (
        typeof self.cursor === 'undefined' ||
        typeof self.cursor['@position'] === 'undefined'
      )
        return false;
      if (typeof self.cursor['@id'] === 'undefined') return false;
      var currentPosition =
        typeof self.cursor['@position'] === 'undefined'
          ? 0
          : parseInt(self.cursor['@position']);
      var currentMaxRows =
        typeof self.cursor['@maxRows'] === 'undefined'
          ? 0
          : parseInt(self.cursor['@maxRows']);
      return currentPosition < currentMaxRows;
    };

    // Returns true if there are records to move backwards in the cursor
    this.hasPrevious = function () {
      if (this.getSize() === 0) return false;
      if (typeof self.cursor === 'undefined') return false;
      var currentPosition =
        typeof self.cursor['@position'] === 'undefined'
          ? 0
          : parseInt(self.cursor['@position']);
      if (currentPosition === 0) return false;

      var numRows =
        typeof self.cursor['@numRows'] === 'undefined'
          ? 0
          : parseInt(self.cursor['@numRows']);
      return currentPosition > numRows;
    };

    // Sends all inserted objects to the backend
    this.create = function (createSettings) {
      var options = $.extend(
        true,
        {},
        settings.defaults,
        settings.create,
        createSettings
      );
      options.synchronizeContent = getUpdateParameters(
        options,
        true,
        false,
        false
      );

      return ajaxUpdate(options);
    };

    // Sends all updated objects to the backend
    this.update = function (updateSettings) {
      var options = $.extend(
        true,
        {},
        settings.defaults,
        settings.update,
        updateSettings
      );
      options.synchronizeContent = getUpdateParameters(
        options,
        false,
        true,
        false
      );

      return ajaxUpdate(options);
    };

    // Sends all deleted objects to the backend.
    this['delete'] = function (deleteSettings) {
      var _deleteOpts = $.extend(
        true,
        {},
        settings.defaults,
        settings['delete'],
        deleteSettings
      );
      _deleteOpts.synchronizeContent = getUpdateParameters(
        _deleteOpts,
        false,
        false,
        true
      );

      return ajaxUpdate(_deleteOpts);
    };

    // Sends all local changes (inserted, updated, deleted objects) to the backend.
    this.synchronize = function (synchronizeSettings) {
      var options = $.extend(
        true,
        {},
        settings.defaults,
        settings.update,
        synchronizeSettings
      );
      options.synchronizeContent = getUpdateParameters(
        options,
        true,
        true,
        true
      );

      return ajaxUpdate(options);
    };

    var getUpdateParameters = function (
      settings,
      sendInsert,
      sendUpdate,
      sendDelete
    ) {
      var synchronizeContent = [];
      var objectsToBeUpdated = [];

      var objects = bindingHandler.getObjects();
      if (objects) {
        for (var objectKey in objects) {
          var object = objects[objectKey];
          if (sendDelete && bindingHandler.isDeletedObject(object)) {
            if (bindingHandler.isInsertedObject(object)) {
              // if it was a newly inserted object that was deleted, let us not send it to the backend, but just silently remove it
              bindingHandler.synchronizeObject(object);
            } else {
              objectsToBeUpdated.push(object);
              // get the old bo from the initial saved state
              var oldObject = bindingHandler.getInitialState(object);
              // get the corresponding XML for the deleted object and add it to the content to be send back
              synchronizeContent.push(
                opts.useTupleProtocol
                  ? wrapInTuple(oldObject, null)
                  : wrapInObject(opts.objectName, oldObject)
              );
            }
          } else if (sendUpdate && bindingHandler.isUpdatedObject(object)) {
            objectsToBeUpdated.push(object);
            // get the old bo from the initial saved state
            var oldObject = bindingHandler.getInitialState(object);
            // get the new bo by unwrapping the Observable object
            var newObject = bindingHandler.getJSObject(object);
            // get the corresponding XML for the object and add it to the updateContent
            synchronizeContent.push(
              opts.useTupleProtocol
                ? wrapInTuple(oldObject, newObject)
                : wrapInObject(opts.objectName, newObject)
            );
          } else if (sendInsert && bindingHandler.isInsertedObject(object)) {
            // just double check whether it was an object deleted before persisting directly using KO API's
            objectsToBeUpdated.push(object);
            // get the new bo by unwrapping the Observable object
            var newObject = bindingHandler.getJSObject(object);
            // get the corresponding XML for the inserted object and add it to the insertContent
            synchronizeContent.push(
              opts.useTupleProtocol
                ? wrapInTuple(null, newObject)
                : wrapInObject(opts.objectName, newObject)
            );
          }
        }
      }
      settings.objectsToBeUpdated = objectsToBeUpdated;
      return objectsToBeUpdated.length > 0
        ? $.cordys.json.js2xmlstring(synchronizeContent, settings.json)
        : '';
    };

    var ajaxUpdate = function (settings) {
      settings._$Def = $.Deferred();
      settings.context = settings; // setting this pointer in all ajax handlers (beforeSend, success, error, done, fail...)
      if (self.isReadOnly || settings.objectsToBeUpdated.length == 0) {
        settings._$Def.reject(null, 'canceled', null, settings); // to be compatible with previous version
      } else {
        var parameterString = settings.parameters
          ? $.cordys.json.js2xmlstring(settings.parameters)
          : undefined;
        if (
          parameterString &&
          parameterString.charAt(parameterString.length - 1) != '>'
        ) {
          parameterString = parameterString + '>';
        }
        settings.parameters = parameterString
          ? parameterString + settings.synchronizeContent
          : settings.synchronizeContent;
        $.cordys
          .ajax(settings)
          .done(function (data, textStatus, jqXHR) {
            mergeUpdate(data, this.objectsToBeUpdated);
            this._$Def.resolve(data, textStatus, this);
          })
          .fail(function (jqXHR, textStatus, errorThrown) {
            handleError(jqXHR.fail(), this.objectsToBeUpdated);
            if (this.showError) {
              showErrorDialog(jqXHR.fail(), 'Error on Update');
            }
            this._$Def.reject(jqXHR, textStatus, errorThrown, this);
          });
      }
      return settings._$Def.promise();
    };

    // handles error in insert, update, delete, sync response. Updates the lock and current state to the current state from the response if specified
    var handleError = function (error, objectsToBeUpdated) {
      if (opts.useTupleProtocol) {
        // let us find the tuples from the error detail
        var tuples = $(error.responseXML).find('detail tuple');
        for (var count = 0; count < tuples.length; count++) {
          var tuple = tuples[count];
          // check for tuples with an error
          if ($(tuple).find('error').length > 0) {
            var faultNew = $(tuple).find('new')[0];
            var faultOld = $(tuple).find('old')[0];
            var objectBeforeUpdation = objectsToBeUpdated[count];

            if (faultNew) {
              if (faultOld) {
                // it is an update failure
                // get the latest persisted state into a json object
                var currentPersistedState = getObjects(
                  $.cordys.json.xml2js(faultOld),
                  self.objectName
                )[0];
                // let us merge the tuples which has the error in it with the latest persisted state in it
                bindingHandler.synchronizeObject(
                  objectBeforeUpdation,
                  currentPersistedState
                );
              } else {
                // it is an insert failure. we do not have anything to do here
              }
            } else {
              // it is an delete failure
              // get the latest persisted state into a json object
              var currentPersistedState = getObjects(
                $.cordys.json.xml2js(faultOld),
                self.objectName
              )[0];
              // let us merge the tuples which has the error in it with the latest persisted state in it
              bindingHandler.synchronizeObject(
                objectBeforeUpdation,
                currentPersistedState
              );
            }
          }
        }
      }
    };

    // merges the response received after insert, update, delete, sync with the current data
    var mergeUpdate = function (data, objectsToBeUpdated) {
      var synchronizedObjects;
      if (opts.useTupleProtocol) {
        // get the updated tuples
        synchronizedObjects = $.map(
          $.isArray(data.tuple) ? data.tuple : [data.tuple],
          function (tuple) {
            return getObjects(
              tuple['new'] ? tuple['new'] : tuple['old'],
              self.objectName
            );
          }
        );
      } else {
        synchronizedObjects = getObjects(data, self.objectName);
      }

      for (var count = 0; count < objectsToBeUpdated.length; count++) {
        var object = objectsToBeUpdated[count];
        // Call sync so that the delete marked object is actually removed
        if (bindingHandler.isDeletedObject(object)) {
          bindingHandler.synchronizeObject(object);
        } else {
          bindingHandler.synchronizeObject(
            object,
            opts.useTupleProtocol
              ? synchronizedObjects[count]
              : bindingHandler.getJSObject(object)
          );
        }
      }
    };

    // create a json structure to represent the tuple with the specified old and new Business Object (can alson pass null  values
    // in case where the old or new is not required
    var wrapInTuple = function (oldBusObject, newBusObject) {
      // Tuple object is formed from either new or old, because the user may change some properties directly on tuple object.
      var tuple =
        (oldBusObject && oldBusObject.getTuple && oldBusObject.getTuple()) ||
        (newBusObject && newBusObject.getTuple && newBusObject.getTuple()) ||
        {};

      //getTuple should be deleted from old and new before forming the final tuple object.
      if (oldBusObject && oldBusObject.getTuple) delete oldBusObject.getTuple;
      if (oldBusObject) {
        tuple.old = wrapInObject(self.objectName, oldBusObject);
      } else {
        delete tuple.old;
      }

      if (newBusObject && newBusObject.getTuple) delete newBusObject.getTuple;
      if (newBusObject) {
        tuple['new'] = wrapInObject(self.objectName, newBusObject);
      } else {
        delete tuple['new'];
      }
      return { tuple: tuple };
    };

    var wrapInObject = function (name, object) {
      var wrappedObject = {};
      wrappedObject[name] = object;
      return wrappedObject;
    };

    var handleCursorAfterRead = function (data, nrObjects) {
      var cursor = getObjects(data, 'cursor')[0];
      if (
        typeof cursor !== 'undefined' &&
        typeof cursor['@id'] === 'undefined' &&
        typeof self.cursor !== 'undefined' &&
        typeof self.cursor['@position'] !== 'undefined'
      ) {
        if (nrObjects === 0) {
          cursor['@position'] = parseInt(self.cursor['@position']);
          self.cursor = cursor;
          self.clear();
          return false;
        } else {
          // in case we do not have an id copy the cursor position from the earlier one and adjust so that we know how to go previous
          cursor['@position'] =
            parseInt(self.cursor['@position']) + parseInt(cursor['@numRows']);
        }
      }

      self.cursor = cursor ? cursor : null;
    };

    // gets all the objects with the specified key name and value. Value is optional
    var getObjects = function (obj, key, val) {
      var objects = [];
      for (var i in obj) {
        if (!obj.hasOwnProperty(i)) continue;
        if (typeof obj[i] == 'object') {
          if (i == key) {
            if ($.isArray(obj[i])) {
              for (var j = 0; j < obj[i].length; j++) {
                objects.push(obj[i][j]);
              }
            } else {
              objects.push(obj[i]);
            }
          } else {
            objects = objects.concat(getObjects(obj[i], key, val));
          }
        } else if (i == key && obj[key] == val) {
          objects.push(obj);
        }
      }
      return objects;
    };
  };

  // default settings for all instances
  $.cordys.model.defaults = {
    useTupleProtocol: true,
    isReadOnly: true,
  };
})(window, jQuery);
/**
 * Cordys Preferences Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  var preferences = {},
    topLevelWindow = $.cordys.getTopLevelWindow
      ? $.cordys.getTopLevelWindow(window)
      : getTopLevelWindow(window); // validation in case of native app

  if (!$.cordys) $.cordys = {};

  $.cordys.preferences = {
    getUserPreferences: function () {
      var _$DefPreferences = $.Deferred();

      _$DefPreferences.done(function (preferences) {
        // save the preferences in session storage
        sessionStorage.setItem('preferences', JSON.stringify(preferences));
      });

      // remove the session storage on login changes
      if (topLevelWindow.$Cordys_LoginDef) {
        topLevelWindow.$Cordys_LoginDef.done(function () {
          sessionStorage.removeItem('preferences');
        });
      }

      // get from the URL parameters
      if (typeof $.cordys.getURLParameter === 'function') {
        preferences.language = $.cordys.getURLParameter(
          window.location,
          'language'
        );
        preferences.locale = $.cordys.getURLParameter(
          window.location,
          'locale'
        );
        preferences.timezoneoffset = $.cordys.getURLParameter(
          window.location,
          'timezoneoffset'
        );
      }

      // get from the session storage
      if (sessionStorage && sessionStorage.preferences) {
        var preferencesData = $.parseJSON(
          sessionStorage.getItem('preferences')
        );
        setPreferences(
          preferencesData.language,
          preferencesData.locale,
          preferencesData.timezoneoffset
        );
      }

      if (
        preferences.language &&
        preferences.locale &&
        preferences.timezoneoffset
      ) {
        _$DefPreferences.resolve(preferences);
      } else {
        // get from getLocale, if in the native app
        if (
          typeof Cordys !== 'undefined' &&
          typeof Cordys.getLocale !== 'undefined'
        ) {
          Cordys.getLocale().done(function (locale) {
            setPreferences(locale, locale, getOffSetTimeZone());
            _$DefPreferences.resolve(preferences);
          });
        }
        // get from the XML store
        else if (typeof $.cordys.ajax != 'undefined') {
          $.cordys
            .ajax({
              method: 'GetXMLObject',
              namespace: 'http://schemas.cordys.com/1.0/xmlstore',
              dataType: 'xml',
              parameters: {
                key: '/Cordys/WCP/Desktop/Preferences/Cordys/WCP/desktop',
              },
            })
            .then(function (response) {
              var timezoneName = $(response).find('timezone') || '',
                locale = $(response).find('locale') || '',
                userlanguage = $(response).find('userlanguage') || '';

              preferences.locale =
                preferences.locale || (locale && locale.text()) || '';
              preferences.language =
                preferences.language ||
                (userlanguage && userlanguage.text()) ||
                '';
              timezoneName = (timezoneName && timezoneName.text()) || '';

              // get the timezone name to get the utcOffset from timezone xml
              if (timezoneName && !preferences.timezoneoffset) {
                timezoneName = timezoneName.replace(
                  new RegExp('[/:]', 'g'),
                  '_'
                );
                $.get(
                  $.cordys.addOrganizationContextToURL(
                    '/cordys/cas/xforms/scripthostlibrary/timezones/' +
                    timezoneName +
                    '.xml'
                  )
                )
                  .done(function (data) {
                    preferences.timezoneoffset = $(data)
                      .find('utcOffset')
                      .text();
                    if (
                      preferences.language &&
                      preferences.locale &&
                      preferences.timezoneoffset
                    ) {
                      _$DefPreferences.resolve(preferences);
                    } else {
                      getUserPreferences(_$DefPreferences);
                    }
                  })
                  .fail(function () {
                    if (
                      preferences.language &&
                      preferences.locale &&
                      preferences.timezoneoffset
                    ) {
                      _$DefPreferences.resolve(preferences);
                    } else {
                      getUserPreferences(_$DefPreferences);
                    }
                  });
              } else {
                getUserPreferences(_$DefPreferences);
              }
            });
        }
      }
      return _$DefPreferences.promise();
    },
  };

  // returns the offset time zone
  function getOffSetTimeZone() {
    return -new Date().getTimezoneOffset();
  }

  function getUserPreferences(_$DefPreferences) {
    // get from mobile globalization API
    if ($.cordys.isMobile && $.cordys.mobile && $.cordys.mobile.globalization) {
      $.cordys.mobile.globalization
        .getLocaleName()
        .done(function (result) {
          setPreferences(result, result, getOffSetTimeZone());
        })
        .fail(function (error) {
          // unable to get the language, take default language
          setDefaultPreferences();
          _$DefPreferences.resolve(preferences);
        });
    } else if (
      (language = window.navigator.language || window.navigator.userLanguage)
    ) {
      //userlanguage is specific to IE
      var userAgent, androidLanguage;
      userAgent = window.navigator.userAgent;
      // navigator.language returns only "en" in all the earlier version of Android (2.3.x) and below. Getting the language from the user-agent String for Android. For other browsers and iOS, taking navigator.language
      if (
        userAgent &&
        (androidLanguage = userAgent.match(/android.*\W(\w\w[_-]\w\w)\W/i))
      ) {
        language = androidLanguage[1];
      }
      language = normalizeLocale(language);
      setPreferences(language, language, getOffSetTimeZone());
      _$DefPreferences.resolve(preferences);
    } else if (typeof $.cordys.ajax != 'undefined') {
      // call TranslationGateway to get user language
      $.cordys
        .ajax({
          url: '/cordys/com.cordys.translation.gateway.TranslationGateway.wcp',
          data: '',
          dataType: 'xml',
          error: function () {
            return false; // skip error message
          },
        })
        .done(function (data) {
          var jsData = $.cordys.json.xml2js(data);
          if (jsData && jsData.browserpreferences) {
            var language = jsData.browserpreferences.language;
            setPreferences(language, language, getOffSetTimeZone());
            _$DefPreferences.resolve(preferences);
          } else {
            setDefaultPreferences();
            _$DefPreferences.resolve(userPreferences);
          }
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
          // unable to get the language, take default language
          setDefaultPreferences();
          _$DefPreferences.resolve(userPreferences);
        });
    } else {
      // unable to get the language, take default language
      setDefaultPreferences();
      _$DefPreferences.resolve(userPreferences);
    }
    return _$DefPreferences.promise();
  }

  // Normalize the locale string for valid format eg: en-US, nl-NL
  function normalizeLocale(locale) {
    return locale.replace('_', '-').replace(/(-[a-z]{2})/, function (a, l) {
      return l.toUpperCase();
    });
  }

  // Sets the default preferences
  function setDefaultPreferences() {
    preferences.language =
      preferences.language ||
      ($.cordys.translation && $.cordys.translation.defaultLanguage);
    preferences.locale = preferences.locale || preferences.language;
    preferences.timezoneoffset =
      preferences.timezoneoffset || getOffSetTimeZone();
  }

  // Sets the preferences
  function setPreferences(language, locale, timezoneoffset) {
    preferences.language = preferences.language || language;
    preferences.locale = preferences.locale || locale;
    preferences.timezoneoffset = preferences.timezoneoffset || timezoneoffset;
  }
})(window, jQuery);
/**
 * Cordys Process Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  if (!$.cordys) {
    throw new Error(
      'The Cordys HTML5 SDK is required, please ensure it is loaded properly'
    );
  }

  $.cordys.process = new (function () {
    var self = this;

    this.getBusinessIdentifiers = function (processInstance, options) {
      options = getOptionsForProcessMethod(
        'GetBusinessIdentifierValues',
        'http://schemas.cordys.com/pim/queryinstancedata/1.0',
        options,
        { processInstanceID: getProcessInstanceId(processInstance) }
      );

      var callback = options.success;
      options.success = null;

      return $.cordys.ajax(options).then(function (response) {
        var identifiers = $.cordys.json.findObjects(
          response,
          'BusinessIdentifier'
        );
        identifiers = identifiers.sort(function (a, b) {
          return parseInt(a.Sequence) > parseInt(b.Sequence);
        });
        if (callback) {
          callback(identifiers);
        }
        return identifiers;
      });
    };

    this.startProcess = function (processIdent, processMessage, options) {
      options = options || {};
      options.parameters = $.extend({ type: 'definition' }, options.parameters);
      return this.executeProcess(processIdent, processMessage, options);
    };

    this.executeProcess = function (processInstance, processMessage, options) {
      options = options || {};
      if ($.isArray(options.parameters)) {
        options.parameters = mergeArraysWithDistinctKey(
          options.parameters || [],
          [
            { name: 'receiver', value: getProcessInstanceId(processInstance) },
            { name: 'type', value: 'instance' },
            { name: 'message', value: processMessage },
          ],
          'name'
        );
      } else {
        options.parameters = $.extend(
          {
            receiver: getProcessInstanceId(processInstance),
            type: 'instance',
            message: processMessage,
          },
          options.parameters
        );
      }
      options = $.extend(
        {
          method: 'ExecuteProcess',
          namespace: 'http://schemas.cordys.com/bpm/execution/1.0',
        },
        options
      );
      return $.cordys.ajax(options);
    };

    return this;
  })();

  function mergeArraysWithDistinctKey(arr1, arr2, key) {
    // Objects from arr2 will only be added when object with same key is not in arr1
    var result = arr1;
    $.each(arr2, function () {
      var value = this[key],
        found = false;
      $.each(arr1, function () {
        if (this[key] == value) found = true;
      });
      if (!found) result.push(this);
    });
    return result;
  }

  function getOptionsForProcessMethod(
    methodName,
    namespace,
    options,
    defaultParameters
  ) {
    options = options || {};
    var ajaxOptions = $.extend(
      {
        method: methodName,
        namespace: namespace || 'http://schemas.cordys.com/bpm/execution/1.0',
      },
      options
    );
    ajaxOptions.parameters = $.extend(defaultParameters, options.parameters);
    return ajaxOptions;
  }

  function getProcessInstanceId(processInstance) {
    var id =
      typeof processInstance === 'object'
        ? processInstance.ProcessInstanceId || processInstance.SourceInstanceId
        : processInstance;
    // If it is an observable, call the method to get the value, otherwise just return the value
    return typeof id === 'function' ? id() : id;
  }
})(window, jQuery);
/**
 * Cordys Translation Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  if (!$.cordys) $.cordys = {};

  var messageBundles = [];

  $.cordys.translation = {
    defaultLanguage: 'en-US',
    xmlstoreRootPath: '/Cordys/WCP/Javascript/translation/',
    nativeRootPath: 'translation/',
    webRootPath: '/cordys/html5/translation/',
  };

  $.cordys.translation.getBundle = function (path, language, isWebFile) {
    return getRuntimeLanguage(language).then(function (language) {
      path = path.replace(/^[\/\\]/, '');
      var key = path + '_' + language;
      var bundle = messageBundles[key];
      if (!bundle) {
        messageBundles[key] = bundle = new MessageBundle(
          path,
          language,
          isWebFile
        );
      }
      return bundle;
    });
  };

  $.cordys.translation.getSystemBundle = function (language) {
    return this.getBundle('html5sdk/sdkmessagebundle', language, true);
  };

  var getRuntimeLanguage = function (language) {
    var _$DefRuntimeLang = $.Deferred();
    if (language) {
      _$DefRuntimeLang.resolve(language);
    }
    // get the language from the user preference
    else {
      $.cordys.preferences.getUserPreferences().done(function (preferences) {
        var lang = preferences.language || $.cordys.translation.defaultLanguage;
        _$DefRuntimeLang.resolve(lang);
      });
    }
    return _$DefRuntimeLang.promise();
  };

  var MessageBundle = function (path, language, isWebFile) {
    var self = this;
    this.path = path;
    this.dictionary = null;

    this.getMessage =
      function (/*any number of arguments supported, first argument should be message id*/) {
        var id = arguments[0],
          label = null,
          ttext = '';
        if (self.dictionary) {
          label = $.cordys.json.find(self.dictionary, '@textidentifier', id);
        }
        ttext = label
          ? label[language]
            ? label[language].text || label[language]
            : id
          : id; //NOMBV
        if (arguments.length > 1) {
          var args = Array.prototype.slice.call(arguments).slice(1); // Create new array without first argument
          ttext = ttext.replace(/\{(\d+)\}/g, function () {
            return typeof args[arguments[1]] !== 'undefined'
              ? args[arguments[1]]
              : arguments[0];
          });
        }
        return ttext;
      };

    this.translate = function (selector, fp) {
      if (!selector) selector = "[data-translatable='true']";
      $(selector).each(function () {
        var $this = $(this);
        if (fp) {
          fp.call(
            this,
            self.getMessage($this.is(':input') ? $this.val() : $this.text())
          );
        } else {
          if ($this.is(':input')) {
            if ($this.is('[placeholder]')) {
              $this.attr(
                'placeholder',
                self.getMessage($this.attr('placeholder').trim())
              );
            } else {
              $this.val(self.getMessage($this.val().trim()));
            }
          } else {
            $this.text(self.getMessage($this.text().trim()));
          }
        }
      });

      // Translate the jQuery Validation messages if jQuery validation plugin is loaded
      if ($.validator && $.validator.messages) {
        $.extend($.validator.messages, {
          required: self.getMessage('REQUIRED'),
          remote: self.getMessage('REMOTE'),
          email: self.getMessage('EMAIL'),
          url: self.getMessage('URL'),
          date: self.getMessage('DATE'),
          dateISO: self.getMessage('DATE_ISO'),
          number: self.getMessage('NUMBER'),
          digits: self.getMessage('DIGITS'),
          creditcard: self.getMessage('CREDITCARD'),
          equalTo: self.getMessage('EQUALTO'),
          maxlength: $.validator.format(self.getMessage('MAX_LENGTH')),
          minlength: $.validator.format(self.getMessage('MIN_LENGTH')),
          rangelength: $.validator.format('RANGE_LENGTH'),
          range: $.validator.format('RANGE'),
          max: $.validator.format('MAX'),
          min: $.validator.format('MIN'),
        });
      }
    };

    var _$DefBundle = $.Deferred();
    var loadMessageBundle = function (path, language, isWebFile) {
      var key = path + '_' + language;
      if (!isWebFile && typeof $.cordys.ajax != 'undefined') {
        return getmlmBundle(key).then(function (response) {
          self.dictionary = $.cordys.json.find(response, 'dictionary');
          if (self.dictionary) _$DefBundle.resolve(self);
          else if (language.indexOf('-') != -1) {
            //locale is removed from language code and try to retrieve only the langauge,For e.g en-US is changed to only en.
            key = path + '_' + language.substring(0, language.indexOf('-'));
            getmlmBundle(key).then(function (response) {
              self.dictionary = $.cordys.json.find(response, 'dictionary');
              _$DefBundle.resolve(self);
            }, errorHandler);
          } else _$DefBundle.resolve(self);
        }, errorHandler);
      } else {
        // called from native. Try to get the resource file from mobile filesystem
        return $.ajax({
          type: 'GET',
          url:
            (isWebFile
              ? $.cordys.addOrganizationContextToURL(
                $.cordys.translation.webRootPath
              )
              : $.cordys.translation.nativeRootPath) +
            key +
            '.xml',
          async: true,
          cache: true,
          dataType: 'xml',
          success: function (response) {
            self.dictionary = $.cordys.json.find(
              $.cordys.json.xml2js(response),
              'dictionary'
            );
            _$DefBundle.resolve(self);
          },
          error: function () {
            //locale is removed from language code and try to retrieve only the langauge,For e.g en-US is changed to only en.
            if (language.indexOf('-') != -1) {
              key = path + '_' + language.substring(0, language.indexOf('-'));
              $.ajax({
                type: 'GET',
                url:
                  (isWebFile
                    ? $.cordys.addOrganizationContextToURL(
                      $.cordys.translation.webRootPath
                    )
                    : $.cordys.translation.nativeRootPath) +
                  key +
                  '.xml',
                async: true,
                dataType: 'xml',
                cache: true,
              }).then(function (response) {
                self.dictionary = $.cordys.json.find(
                  $.cordys.json.xml2js(response),
                  'dictionary'
                );
                _$DefBundle.resolve(self);
              }, errorHandler);
            } else {
              self.dictionary = {};
              _$DefBundle.resolve(self);
            }
          },
        });
      }
    };

    function getmlmBundle(key) {
      return $.cordys.ajax({
        method: 'GetXMLObject',
        namespace: 'http://schemas.cordys.com/1.0/xmlstore',
        context: self,
        parameters: {
          key: $.cordys.translation.xmlstoreRootPath + key + '.mlm',
        },
      });
    }

    var errorHandler = function (jqXHR, textStatus, errorThrown) {
      if (language !== $.cordys.translation.defaultLanguage) {
        loadMessageBundle(
          path,
          $.cordys.translation.defaultLanguage,
          isWebFile
        );
      } else {
        _$DefBundle.reject();
        console.log(
          'An error occurred while retrieving the language package. The error details are as follows: ' +
          textStatus
        );
      }
    };

    loadMessageBundle(this.path, language, isWebFile);
    return _$DefBundle;
  };
})(window, jQuery);

/**
 * Cordys Workflow Plugin
 *
 * Copyright (c) 2013 Cordys
 */
(function (window, $, undefined) {
  if (!$.cordys) {
    throw new Error(
      'The Cordys HTML5 SDK is required, please ensure it is loaded properly'
    );
  }

  $.cordys.workflow = new (function () {
    var self = this;

    this.getTasks = function (options) {
      options = getOptionsForWorkflowMethod('GetTasks', '', options, {
        OrderBy: 'Task.StartDate DESC',
        ShowNonWorkableItems: 'false',
        ReturnTaskData: 'false',
      });
      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'Task');
      });
    };
    this.getAllTasksForUser = function (options) {
      options = getOptionsForWorkflowMethod('GetAllTasksForUser', '', options, {
        OrderBy: 'Task.StartDate DESC',
      });
      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'Task');
      });
    };
    this.getPersonalTasks = function (options) {
      options = getOptionsForWorkflowMethod('GetTasks', '', options, {
        OrderBy: 'Task.StartDate DESC',
      });
      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'Task');
      });
    };
    this.getTaskDetails = function (task, options) {
      options = options || {};
      options.parameters = options.parameters || {};
      options.parameters.TaskId = getTaskId(task);
      options = getOptionsForWorkflowMethod('GetTask', '', options, {
        ReturnTaskData: 'true',
        RetrievePossibleActions: 'true',
      });
      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.find(response, 'Task');
      });
    };
    this.getAllTargets = function (options) {
      options = getOptionsForWorkflowMethod('GetAllTargets', '', options, {
        TaskCountRequired: 'true',
      });
      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'Target');
      });
    };
    this.getWorkLists = function (options) {
      options = getOptionsForWorkflowMethod(
        'GetAllWorklistsForUser',
        '',
        options
      );
      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'Worklist');
      });
    };

    this.claimTask = function (task, options) {
      options = getOptionsForWorkflowMethod('ClaimTask', '', options, {
        TaskId: getTaskId(task),
      });
      return $.cordys.ajax(options);
    };
    this.delegateTask = function (task, user, memo, options) {
      options = getOptionsForWorkflowMethod('DelegateTask', '', options, {
        TaskId: getTaskId(task),
        TransferOwnership: 'true',
        Memo: memo || '',
        SendTo: {
          UserDN: user,
        },
      });
      return $.cordys.ajax(options);
    };
    this.performTaskAction = function (
      task,
      taskData,
      action,
      reason,
      options
    ) {
      options = getOptionsForWorkflowMethod('PerformTaskAction', '', options, {
        TaskId: getTaskId(task),
        Action: action,
        Memo: reason,
        Data: taskData || {},
      });
      return $.cordys.ajax(options);
    };

    this.completeTask = function (task, taskData, options) {
      return this.performTaskAction(task, taskData, 'COMPLETE', '', options);
    };
    this.pauseTask = function (task, taskData, options) {
      return this.performTaskAction(task, taskData, 'PAUSE', '', options);
    };
    this.resumeTask = function (task, taskData, options) {
      return this.performTaskAction(task, taskData, 'RESUME', '', options);
    };
    this.revokeTask = function (task, taskData, options) {
      return this.performTaskAction(task, taskData, 'REVOKECLAIM', '', options);
    };
    this.skipTask = function (task, taskData, reason, options) {
      return this.performTaskAction(task, taskData, 'SKIP', reason, options);
    };
    this.startTask = function (task, taskData, options) {
      return this.performTaskAction(task, taskData, 'START', '', options);
    };
    this.stopTask = function (task, taskData, options) {
      return this.performTaskAction(task, taskData, 'STOP', '', options);
    };
    this.suspendTask = function (task, taskData, options) {
      return this.performTaskAction(task, taskData, 'SUSPEND', '', options);
    };

    this.isCaseActivity = function (task) {
      var taskType = getTaskType(task);
      return taskType ? taskType === 'CASE' : -1;
    };

    // Attachments
    this.getAttachments = function (task, options) {
      if (typeof task == 'string') {
        var asyncvalue = options ? options.async : undefined; //NOMBV
        var defaultsAsync = $.cordys.ajax.defaults.async; //NOMBV
        return $.cordys.workflow
          .getTaskDetails(task, {
            async:
              options && asyncvalue !== undefined ? asyncvalue : defaultsAsync,
          })
          .then(function (taskObject) {
            return $.cordys.workflow.getAttachments(taskObject, options);
          });
      }
      options = getOptionsForWorkflowMethod(
        'GetAttachments',
        'http://schemas.cordys.com/bpm/attachments/1.0',
        options,
        {
          instanceid: {
            '@type': getTaskType(task),
            text: getInstanceId(task),
          },
          activityid: task.ActivityId || task.Activity['@id'],
        }
      );

      return $.cordys.ajax(options).then(function (response) {
        return $.cordys.json.findObjects(response, 'instance');
      });
    };

    this.addAttachment = function (
      task,
      attachmentName,
      fileName,
      description,
      content,
      options
    ) {
      if (typeof task == 'string') {
        var asyncvalue = options ? options.async : undefined; //NOMBV
        var defaultsAsync = $.cordys.ajax.defaults.async; //NOMBV
        return $.cordys.workflow
          .getTaskDetails(task, {
            async:
              options && asyncvalue !== undefined ? asyncvalue : defaultsAsync,
          })
          .then(function (taskObject) {
            return $.cordys.workflow.addAttachment(
              taskObject,
              attachmentName,
              fileName,
              description,
              content,
              options
            );
          });
      }
      var isURL = /^[a-zA-Z].*\:/.test(content);
      if (isURL) {
        // upload the file
        if ($.cordys.mobile) {
          $.cordys.mobile.fileReader.readAsDataURL(
            content,
            function (result) {
              // content retrieved as base64 encoded
              content = result.replace(/^.*base64,/, '');
              options = getOptionsForWorkflowMethod(
                'UploadAttachment',
                'http://schemas.cordys.com/bpm/attachments/1.0',
                options,
                {
                  instanceid: {
                    '@type': getTaskType(task),
                    text: getInstanceId(task),
                  },
                  activityid: task.ActivityId || task.Activity['@id'],
                  attachmentname: attachmentName,
                  filename: fileName,
                  description: description,
                  content: {
                    '@isURL': false,
                    text: content,
                  },
                }
              );
              $.cordys.ajax(options);
            },
            function (error) {
              throw new Error(
                'Unable to read file, error: ' + JSON.stringify(error)
              );
            }
          );
        } else {
          throw new Error('Unable to add attachment by url');
        }
      } else {
        // content should be base64 encoded
        if (
          !/^[a-z0-9\+\/\s]+\={0,2}$/i.test(content) ||
          content.length % 4 > 0
        ) {
          if (window.btoa) content = window.btoa(content);
          else throw new Error('Unable to convert data to base64');
        }
        options = getOptionsForWorkflowMethod(
          'UploadAttachment',
          'http://schemas.cordys.com/bpm/attachments/1.0',
          options,
          {
            instanceid: {
              '@type': getTaskType(task),
              text: getInstanceId(task),
            },
            activityid: task.ActivityId || task.Activity['@id'],
            attachmentname: attachmentName,
            filename: fileName,
            description: description,
            content: {
              '@isURL': false,
              text: content,
            },
          }
        );
        return $.cordys.ajax(options);
      }
    };

    this.uploadAttachment = function (
      task,
      attachmentName,
      fileName,
      description,
      url,
      options
    ) {
      if (typeof task == 'string') {
        var asyncvalue = options.async; //NOMBV
        var defaultsAsync = $.cordys.ajax.defaults.async; //NOMBV
        return $.cordys.workflow
          .getTaskDetails(task, {
            async:
              options && asyncvalue !== undefined ? asyncvalue : defaultsAsync,
          })
          .then(function (taskObject) {
            return $.cordys.workflow.uploadAttachment(
              taskObject,
              attachmentName,
              fileName,
              description,
              url,
              options
            );
          });
      }
      options = getOptionsForWorkflowMethod(
        'UploadAttachment',
        'http://schemas.cordys.com/bpm/attachments/1.0',
        options,
        {
          instanceid: {
            '@type': getTaskType(task),
            text: getInstanceId(task),
          },
          activityid: task.ActivityId || task.Activity['@id'],
          attachmentname: attachmentName,
          filename: fileName,
          description: description,
          content: {
            '@isURL': true,
            text: url,
          },
        }
      );
      return $.cordys.ajax(options);
    };

    this.removeAttachment = function (
      task,
      attachmentName,
      fileName,
      documenturl,
      options
    ) {
      if (typeof task == 'string') {
        var asyncvalue = options.async; //NOMBV
        var defaultsAsync = $.cordys.ajax.defaults.async; //NOMBV
        return $.cordys.workflow
          .getTaskDetails(task, {
            async:
              options && asyncvalue !== undefined ? asyncvalue : defaultsAsync,
          })
          .then(function (taskObject) {
            return $.cordys.workflow.removeAttachment(
              taskObject,
              attachmentName,
              fileName,
              documenturl,
              options
            );
          });
      }
      options = getOptionsForWorkflowMethod(
        'DeleteAttachment',
        'http://schemas.cordys.com/bpm/attachments/1.0',
        options,
        {
          instanceid: {
            '@type': getTaskType(task),
            text: getInstanceId(task),
          },
          activityid: task.ActivityId || task.Activity['@id'],
          attachmentname: attachmentName,
          filename: fileName,
          documenturl: documenturl,
        }
      );
      return $.cordys.ajax(options);
    };

    return this;
  })();

  function getOptionsForWorkflowMethod(
    methodName,
    namespace,
    options,
    defaultParameters
  ) {
    options = options || {};
    var ajaxOptions = $.extend(
      {
        method: methodName,
        namespace:
          namespace || 'http://schemas.cordys.com/notification/workflow/1.0',
      },
      options
    );
    ajaxOptions.parameters = $.extend(defaultParameters, options.parameters);
    return ajaxOptions;
  }

  function getTaskId(task) {
    var id = typeof task === 'object' ? task.TaskId : task;
    // If it is an observable, call the method to get the value, otherwise just return the value
    return typeof id === 'function' ? id() : id;
  }

  function getTaskType(task) {
    if (typeof task !== 'object') return '';
    return task.SourceType || task.Component;
  }

  function getInstanceId(task) {
    if (typeof task === 'string') return task;
    var id = $.cordys.workflow.isCaseActivity(task)
      ? task.ProcessInstanceId ||
      task.CaseInstanceId ||
      task.SourceInstanceId ||
      task.RootInstanceId ||
      task.caseinstanceid
      : task.ProcessInstanceId || task.SourceInstanceId;
    // If it is an observable, call the method to get the value, otherwise just return the value
    return typeof id === 'function' ? id() : id;
  }
})(window, jQuery);
