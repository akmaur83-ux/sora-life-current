(function () {
	'use strict';

	function _mergeNamespaces(n, m) {
		m.forEach(function (e) {
			e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
				if (k !== 'default' && !(k in n)) {
					var d = Object.getOwnPropertyDescriptor(e, k);
					Object.defineProperty(n, k, d.get ? d : {
						enumerable: true,
						get: function () { return e[k]; }
					});
				}
			});
		});
		return Object.freeze(n);
	}

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var react = {exports: {}};

	var react_production_min = {};

	/**
	 * @license React
	 * react.production.min.js
	 *
	 * Copyright (c) Facebook, Inc. and its affiliates.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */
	var l$1=Symbol.for("react.element"),n$1=Symbol.for("react.portal"),p$2=Symbol.for("react.fragment"),q$1=Symbol.for("react.strict_mode"),r=Symbol.for("react.profiler"),t=Symbol.for("react.provider"),u=Symbol.for("react.context"),v$1=Symbol.for("react.forward_ref"),w=Symbol.for("react.suspense"),x=Symbol.for("react.memo"),y=Symbol.for("react.lazy"),z$1=Symbol.iterator;function A$1(a){if(null===a||"object"!==typeof a)return null;a=z$1&&a[z$1]||a["@@iterator"];return "function"===typeof a?a:null}
	var B$1={isMounted:function(){return !1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},C$1=Object.assign,D$1={};function E$1(a,b,e){this.props=a;this.context=b;this.refs=D$1;this.updater=e||B$1;}E$1.prototype.isReactComponent={};
	E$1.prototype.setState=function(a,b){if("object"!==typeof a&&"function"!==typeof a&&null!=a)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,a,b,"setState");};E$1.prototype.forceUpdate=function(a){this.updater.enqueueForceUpdate(this,a,"forceUpdate");};function F(){}F.prototype=E$1.prototype;function G$1(a,b,e){this.props=a;this.context=b;this.refs=D$1;this.updater=e||B$1;}var H$1=G$1.prototype=new F;
	H$1.constructor=G$1;C$1(H$1,E$1.prototype);H$1.isPureReactComponent=!0;var I$1=Array.isArray,J=Object.prototype.hasOwnProperty,K$1={current:null},L$1={key:!0,ref:!0,__self:!0,__source:!0};
	function M$1(a,b,e){var d,c={},k=null,h=null;if(null!=b)for(d in void 0!==b.ref&&(h=b.ref),void 0!==b.key&&(k=""+b.key),b)J.call(b,d)&&!L$1.hasOwnProperty(d)&&(c[d]=b[d]);var g=arguments.length-2;if(1===g)c.children=e;else if(1<g){for(var f=Array(g),m=0;m<g;m++)f[m]=arguments[m+2];c.children=f;}if(a&&a.defaultProps)for(d in g=a.defaultProps,g)void 0===c[d]&&(c[d]=g[d]);return {$$typeof:l$1,type:a,key:k,ref:h,props:c,_owner:K$1.current}}
	function N$1(a,b){return {$$typeof:l$1,type:a.type,key:b,ref:a.ref,props:a.props,_owner:a._owner}}function O$1(a){return "object"===typeof a&&null!==a&&a.$$typeof===l$1}function escape(a){var b={"=":"=0",":":"=2"};return "$"+a.replace(/[=:]/g,function(a){return b[a]})}var P$2=/\/+/g;function Q$1(a,b){return "object"===typeof a&&null!==a&&null!=a.key?escape(""+a.key):b.toString(36)}
	function R$1(a,b,e,d,c){var k=typeof a;if("undefined"===k||"boolean"===k)a=null;var h=!1;if(null===a)h=!0;else switch(k){case "string":case "number":h=!0;break;case "object":switch(a.$$typeof){case l$1:case n$1:h=!0;}}if(h)return h=a,c=c(h),a=""===d?"."+Q$1(h,0):d,I$1(c)?(e="",null!=a&&(e=a.replace(P$2,"$&/")+"/"),R$1(c,b,e,"",function(a){return a})):null!=c&&(O$1(c)&&(c=N$1(c,e+(!c.key||h&&h.key===c.key?"":(""+c.key).replace(P$2,"$&/")+"/")+a)),b.push(c)),1;h=0;d=""===d?".":d+":";if(I$1(a))for(var g=0;g<a.length;g++){k=
	a[g];var f=d+Q$1(k,g);h+=R$1(k,b,e,f,c);}else if(f=A$1(a),"function"===typeof f)for(a=f.call(a),g=0;!(k=a.next()).done;)k=k.value,f=d+Q$1(k,g++),h+=R$1(k,b,e,f,c);else if("object"===k)throw b=String(a),Error("Objects are not valid as a React child (found: "+("[object Object]"===b?"object with keys {"+Object.keys(a).join(", ")+"}":b)+"). If you meant to render a collection of children, use an array instead.");return h}
	function S$1(a,b,e){if(null==a)return a;var d=[],c=0;R$1(a,d,"","",function(a){return b.call(e,a,c++)});return d}function T$1(a){if(-1===a._status){var b=a._result;b=b();b.then(function(b){if(0===a._status||-1===a._status)a._status=1,a._result=b;},function(b){if(0===a._status||-1===a._status)a._status=2,a._result=b;});-1===a._status&&(a._status=0,a._result=b);}if(1===a._status)return a._result.default;throw a._result;}
	var U$1={current:null},V$1={transition:null},W$1={ReactCurrentDispatcher:U$1,ReactCurrentBatchConfig:V$1,ReactCurrentOwner:K$1};function X$1(){throw Error("act(...) is not supported in production builds of React.");}
	react_production_min.Children={map:S$1,forEach:function(a,b,e){S$1(a,function(){b.apply(this,arguments);},e);},count:function(a){var b=0;S$1(a,function(){b++;});return b},toArray:function(a){return S$1(a,function(a){return a})||[]},only:function(a){if(!O$1(a))throw Error("React.Children.only expected to receive a single React element child.");return a}};react_production_min.Component=E$1;react_production_min.Fragment=p$2;react_production_min.Profiler=r;react_production_min.PureComponent=G$1;react_production_min.StrictMode=q$1;react_production_min.Suspense=w;
	react_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=W$1;react_production_min.act=X$1;
	react_production_min.cloneElement=function(a,b,e){if(null===a||void 0===a)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+a+".");var d=C$1({},a.props),c=a.key,k=a.ref,h=a._owner;if(null!=b){void 0!==b.ref&&(k=b.ref,h=K$1.current);void 0!==b.key&&(c=""+b.key);if(a.type&&a.type.defaultProps)var g=a.type.defaultProps;for(f in b)J.call(b,f)&&!L$1.hasOwnProperty(f)&&(d[f]=void 0===b[f]&&void 0!==g?g[f]:b[f]);}var f=arguments.length-2;if(1===f)d.children=e;else if(1<f){g=Array(f);
	for(var m=0;m<f;m++)g[m]=arguments[m+2];d.children=g;}return {$$typeof:l$1,type:a.type,key:c,ref:k,props:d,_owner:h}};react_production_min.createContext=function(a){a={$$typeof:u,_currentValue:a,_currentValue2:a,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null};a.Provider={$$typeof:t,_context:a};return a.Consumer=a};react_production_min.createElement=M$1;react_production_min.createFactory=function(a){var b=M$1.bind(null,a);b.type=a;return b};react_production_min.createRef=function(){return {current:null}};
	react_production_min.forwardRef=function(a){return {$$typeof:v$1,render:a}};react_production_min.isValidElement=O$1;react_production_min.lazy=function(a){return {$$typeof:y,_payload:{_status:-1,_result:a},_init:T$1}};react_production_min.memo=function(a,b){return {$$typeof:x,type:a,compare:void 0===b?null:b}};react_production_min.startTransition=function(a){var b=V$1.transition;V$1.transition={};try{a();}finally{V$1.transition=b;}};react_production_min.unstable_act=X$1;react_production_min.useCallback=function(a,b){return U$1.current.useCallback(a,b)};react_production_min.useContext=function(a){return U$1.current.useContext(a)};
	react_production_min.useDebugValue=function(){};react_production_min.useDeferredValue=function(a){return U$1.current.useDeferredValue(a)};react_production_min.useEffect=function(a,b){return U$1.current.useEffect(a,b)};react_production_min.useId=function(){return U$1.current.useId()};react_production_min.useImperativeHandle=function(a,b,e){return U$1.current.useImperativeHandle(a,b,e)};react_production_min.useInsertionEffect=function(a,b){return U$1.current.useInsertionEffect(a,b)};react_production_min.useLayoutEffect=function(a,b){return U$1.current.useLayoutEffect(a,b)};
	react_production_min.useMemo=function(a,b){return U$1.current.useMemo(a,b)};react_production_min.useReducer=function(a,b,e){return U$1.current.useReducer(a,b,e)};react_production_min.useRef=function(a){return U$1.current.useRef(a)};react_production_min.useState=function(a){return U$1.current.useState(a)};react_production_min.useSyncExternalStore=function(a,b,e){return U$1.current.useSyncExternalStore(a,b,e)};react_production_min.useTransition=function(){return U$1.current.useTransition()};react_production_min.version="18.3.1";

	{
	  react.exports = react_production_min;
	}

	var reactExports = react.exports;
	var React = /*@__PURE__*/getDefaultExportFromCjs(reactExports);

	var React$1 = /*#__PURE__*/_mergeNamespaces({
		__proto__: null,
		default: React
	}, [reactExports]);

	var client = {};

	var reactDom = {exports: {}};

	var reactDom_production_min = {};

	var scheduler = {exports: {}};

	var scheduler_production_min = {};

	/**
	 * @license React
	 * scheduler.production.min.js
	 *
	 * Copyright (c) Facebook, Inc. and its affiliates.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	(function (exports) {
	function f(a,b){var c=a.length;a.push(b);a:for(;0<c;){var d=c-1>>>1,e=a[d];if(0<g(e,b))a[d]=b,a[c]=e,c=d;else break a}}function h(a){return 0===a.length?null:a[0]}function k(a){if(0===a.length)return null;var b=a[0],c=a.pop();if(c!==b){a[0]=c;a:for(var d=0,e=a.length,w=e>>>1;d<w;){var m=2*(d+1)-1,C=a[m],n=m+1,x=a[n];if(0>g(C,c))n<e&&0>g(x,C)?(a[d]=x,a[n]=c,d=n):(a[d]=C,a[m]=c,d=m);else if(n<e&&0>g(x,c))a[d]=x,a[n]=c,d=n;else break a}}return b}
		function g(a,b){var c=a.sortIndex-b.sortIndex;return 0!==c?c:a.id-b.id}if("object"===typeof performance&&"function"===typeof performance.now){var l=performance;exports.unstable_now=function(){return l.now()};}else {var p=Date,q=p.now();exports.unstable_now=function(){return p.now()-q};}var r=[],t=[],u=1,v=null,y=3,z=!1,A=!1,B=!1,D="function"===typeof setTimeout?setTimeout:null,E="function"===typeof clearTimeout?clearTimeout:null,F="undefined"!==typeof setImmediate?setImmediate:null;
		"undefined"!==typeof navigator&&void 0!==navigator.scheduling&&void 0!==navigator.scheduling.isInputPending&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function G(a){for(var b=h(t);null!==b;){if(null===b.callback)k(t);else if(b.startTime<=a)k(t),b.sortIndex=b.expirationTime,f(r,b);else break;b=h(t);}}function H(a){B=!1;G(a);if(!A)if(null!==h(r))A=!0,I(J);else {var b=h(t);null!==b&&K(H,b.startTime-a);}}
		function J(a,b){A=!1;B&&(B=!1,E(L),L=-1);z=!0;var c=y;try{G(b);for(v=h(r);null!==v&&(!(v.expirationTime>b)||a&&!M());){var d=v.callback;if("function"===typeof d){v.callback=null;y=v.priorityLevel;var e=d(v.expirationTime<=b);b=exports.unstable_now();"function"===typeof e?v.callback=e:v===h(r)&&k(r);G(b);}else k(r);v=h(r);}if(null!==v)var w=!0;else {var m=h(t);null!==m&&K(H,m.startTime-b);w=!1;}return w}finally{v=null,y=c,z=!1;}}var N=!1,O=null,L=-1,P=5,Q=-1;
		function M(){return exports.unstable_now()-Q<P?!1:!0}function R(){if(null!==O){var a=exports.unstable_now();Q=a;var b=!0;try{b=O(!0,a);}finally{b?S():(N=!1,O=null);}}else N=!1;}var S;if("function"===typeof F)S=function(){F(R);};else if("undefined"!==typeof MessageChannel){var T=new MessageChannel,U=T.port2;T.port1.onmessage=R;S=function(){U.postMessage(null);};}else S=function(){D(R,0);};function I(a){O=a;N||(N=!0,S());}function K(a,b){L=D(function(){a(exports.unstable_now());},b);}
		exports.unstable_IdlePriority=5;exports.unstable_ImmediatePriority=1;exports.unstable_LowPriority=4;exports.unstable_NormalPriority=3;exports.unstable_Profiling=null;exports.unstable_UserBlockingPriority=2;exports.unstable_cancelCallback=function(a){a.callback=null;};exports.unstable_continueExecution=function(){A||z||(A=!0,I(J));};
		exports.unstable_forceFrameRate=function(a){0>a||125<a?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):P=0<a?Math.floor(1E3/a):5;};exports.unstable_getCurrentPriorityLevel=function(){return y};exports.unstable_getFirstCallbackNode=function(){return h(r)};exports.unstable_next=function(a){switch(y){case 1:case 2:case 3:var b=3;break;default:b=y;}var c=y;y=b;try{return a()}finally{y=c;}};exports.unstable_pauseExecution=function(){};
		exports.unstable_requestPaint=function(){};exports.unstable_runWithPriority=function(a,b){switch(a){case 1:case 2:case 3:case 4:case 5:break;default:a=3;}var c=y;y=a;try{return b()}finally{y=c;}};
		exports.unstable_scheduleCallback=function(a,b,c){var d=exports.unstable_now();"object"===typeof c&&null!==c?(c=c.delay,c="number"===typeof c&&0<c?d+c:d):c=d;switch(a){case 1:var e=-1;break;case 2:e=250;break;case 5:e=1073741823;break;case 4:e=1E4;break;default:e=5E3;}e=c+e;a={id:u++,callback:b,priorityLevel:a,startTime:c,expirationTime:e,sortIndex:-1};c>d?(a.sortIndex=c,f(t,a),null===h(r)&&a===h(t)&&(B?(E(L),L=-1):B=!0,K(H,c-d))):(a.sortIndex=e,f(r,a),A||z||(A=!0,I(J)));return a};
		exports.unstable_shouldYield=M;exports.unstable_wrapCallback=function(a){var b=y;return function(){var c=y;y=b;try{return a.apply(this,arguments)}finally{y=c;}}}; 
	} (scheduler_production_min));

	{
	  scheduler.exports = scheduler_production_min;
	}

	var schedulerExports = scheduler.exports;

	/**
	 * @license React
	 * react-dom.production.min.js
	 *
	 * Copyright (c) Facebook, Inc. and its affiliates.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */
	var aa=reactExports,ca=schedulerExports;function p$1(a){for(var b="https://reactjs.org/docs/error-decoder.html?invariant="+a,c=1;c<arguments.length;c++)b+="&args[]="+encodeURIComponent(arguments[c]);return "Minified React error #"+a+"; visit "+b+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var da=new Set,ea={};function fa(a,b){ha(a,b);ha(a+"Capture",b);}
	function ha(a,b){ea[a]=b;for(a=0;a<b.length;a++)da.add(b[a]);}
	var ia=!("undefined"===typeof window||"undefined"===typeof window.document||"undefined"===typeof window.document.createElement),ja=Object.prototype.hasOwnProperty,ka=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,la=
	{},ma={};function oa(a){if(ja.call(ma,a))return !0;if(ja.call(la,a))return !1;if(ka.test(a))return ma[a]=!0;la[a]=!0;return !1}function pa(a,b,c,d){if(null!==c&&0===c.type)return !1;switch(typeof b){case "function":case "symbol":return !0;case "boolean":if(d)return !1;if(null!==c)return !c.acceptsBooleans;a=a.toLowerCase().slice(0,5);return "data-"!==a&&"aria-"!==a;default:return !1}}
	function qa(a,b,c,d){if(null===b||"undefined"===typeof b||pa(a,b,c,d))return !0;if(d)return !1;if(null!==c)switch(c.type){case 3:return !b;case 4:return !1===b;case 5:return isNaN(b);case 6:return isNaN(b)||1>b}return !1}function v(a,b,c,d,e,f,g){this.acceptsBooleans=2===b||3===b||4===b;this.attributeName=d;this.attributeNamespace=e;this.mustUseProperty=c;this.propertyName=a;this.type=b;this.sanitizeURL=f;this.removeEmptyString=g;}var z={};
	"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a){z[a]=new v(a,0,!1,a,null,!1,!1);});[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(a){var b=a[0];z[b]=new v(b,1,!1,a[1],null,!1,!1);});["contentEditable","draggable","spellCheck","value"].forEach(function(a){z[a]=new v(a,2,!1,a.toLowerCase(),null,!1,!1);});
	["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(a){z[a]=new v(a,2,!1,a,null,!1,!1);});"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a){z[a]=new v(a,3,!1,a.toLowerCase(),null,!1,!1);});
	["checked","multiple","muted","selected"].forEach(function(a){z[a]=new v(a,3,!0,a,null,!1,!1);});["capture","download"].forEach(function(a){z[a]=new v(a,4,!1,a,null,!1,!1);});["cols","rows","size","span"].forEach(function(a){z[a]=new v(a,6,!1,a,null,!1,!1);});["rowSpan","start"].forEach(function(a){z[a]=new v(a,5,!1,a.toLowerCase(),null,!1,!1);});var ra=/[\-:]([a-z])/g;function sa(a){return a[1].toUpperCase()}
	"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a){var b=a.replace(ra,
	sa);z[b]=new v(b,1,!1,a,null,!1,!1);});"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a){var b=a.replace(ra,sa);z[b]=new v(b,1,!1,a,"http://www.w3.org/1999/xlink",!1,!1);});["xml:base","xml:lang","xml:space"].forEach(function(a){var b=a.replace(ra,sa);z[b]=new v(b,1,!1,a,"http://www.w3.org/XML/1998/namespace",!1,!1);});["tabIndex","crossOrigin"].forEach(function(a){z[a]=new v(a,1,!1,a.toLowerCase(),null,!1,!1);});
	z.xlinkHref=new v("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach(function(a){z[a]=new v(a,1,!1,a.toLowerCase(),null,!0,!0);});
	function ta(a,b,c,d){var e=z.hasOwnProperty(b)?z[b]:null;if(null!==e?0!==e.type:d||!(2<b.length)||"o"!==b[0]&&"O"!==b[0]||"n"!==b[1]&&"N"!==b[1])qa(b,c,e,d)&&(c=null),d||null===e?oa(b)&&(null===c?a.removeAttribute(b):a.setAttribute(b,""+c)):e.mustUseProperty?a[e.propertyName]=null===c?3===e.type?!1:"":c:(b=e.attributeName,d=e.attributeNamespace,null===c?a.removeAttribute(b):(e=e.type,c=3===e||4===e&&!0===c?"":""+c,d?a.setAttributeNS(d,b,c):a.setAttribute(b,c)));}
	var ua=aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,va=Symbol.for("react.element"),wa=Symbol.for("react.portal"),ya=Symbol.for("react.fragment"),za=Symbol.for("react.strict_mode"),Aa=Symbol.for("react.profiler"),Ba=Symbol.for("react.provider"),Ca=Symbol.for("react.context"),Da=Symbol.for("react.forward_ref"),Ea=Symbol.for("react.suspense"),Fa=Symbol.for("react.suspense_list"),Ga=Symbol.for("react.memo"),Ha=Symbol.for("react.lazy");var Ia=Symbol.for("react.offscreen");var Ja=Symbol.iterator;function Ka(a){if(null===a||"object"!==typeof a)return null;a=Ja&&a[Ja]||a["@@iterator"];return "function"===typeof a?a:null}var A=Object.assign,La;function Ma(a){if(void 0===La)try{throw Error();}catch(c){var b=c.stack.trim().match(/\n( *(at )?)/);La=b&&b[1]||"";}return "\n"+La+a}var Na=!1;
	function Oa(a,b){if(!a||Na)return "";Na=!0;var c=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(b)if(b=function(){throw Error();},Object.defineProperty(b.prototype,"props",{set:function(){throw Error();}}),"object"===typeof Reflect&&Reflect.construct){try{Reflect.construct(b,[]);}catch(l){var d=l;}Reflect.construct(a,[],b);}else {try{b.call();}catch(l){d=l;}a.call(b.prototype);}else {try{throw Error();}catch(l){d=l;}a();}}catch(l){if(l&&d&&"string"===typeof l.stack){for(var e=l.stack.split("\n"),
	f=d.stack.split("\n"),g=e.length-1,h=f.length-1;1<=g&&0<=h&&e[g]!==f[h];)h--;for(;1<=g&&0<=h;g--,h--)if(e[g]!==f[h]){if(1!==g||1!==h){do if(g--,h--,0>h||e[g]!==f[h]){var k="\n"+e[g].replace(" at new "," at ");a.displayName&&k.includes("<anonymous>")&&(k=k.replace("<anonymous>",a.displayName));return k}while(1<=g&&0<=h)}break}}}finally{Na=!1,Error.prepareStackTrace=c;}return (a=a?a.displayName||a.name:"")?Ma(a):""}
	function Pa(a){switch(a.tag){case 5:return Ma(a.type);case 16:return Ma("Lazy");case 13:return Ma("Suspense");case 19:return Ma("SuspenseList");case 0:case 2:case 15:return a=Oa(a.type,!1),a;case 11:return a=Oa(a.type.render,!1),a;case 1:return a=Oa(a.type,!0),a;default:return ""}}
	function Qa(a){if(null==a)return null;if("function"===typeof a)return a.displayName||a.name||null;if("string"===typeof a)return a;switch(a){case ya:return "Fragment";case wa:return "Portal";case Aa:return "Profiler";case za:return "StrictMode";case Ea:return "Suspense";case Fa:return "SuspenseList"}if("object"===typeof a)switch(a.$$typeof){case Ca:return (a.displayName||"Context")+".Consumer";case Ba:return (a._context.displayName||"Context")+".Provider";case Da:var b=a.render;a=a.displayName;a||(a=b.displayName||
	b.name||"",a=""!==a?"ForwardRef("+a+")":"ForwardRef");return a;case Ga:return b=a.displayName||null,null!==b?b:Qa(a.type)||"Memo";case Ha:b=a._payload;a=a._init;try{return Qa(a(b))}catch(c){}}return null}
	function Ra(a){var b=a.type;switch(a.tag){case 24:return "Cache";case 9:return (b.displayName||"Context")+".Consumer";case 10:return (b._context.displayName||"Context")+".Provider";case 18:return "DehydratedFragment";case 11:return a=b.render,a=a.displayName||a.name||"",b.displayName||(""!==a?"ForwardRef("+a+")":"ForwardRef");case 7:return "Fragment";case 5:return b;case 4:return "Portal";case 3:return "Root";case 6:return "Text";case 16:return Qa(b);case 8:return b===za?"StrictMode":"Mode";case 22:return "Offscreen";
	case 12:return "Profiler";case 21:return "Scope";case 13:return "Suspense";case 19:return "SuspenseList";case 25:return "TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if("function"===typeof b)return b.displayName||b.name||null;if("string"===typeof b)return b}return null}function Sa(a){switch(typeof a){case "boolean":case "number":case "string":case "undefined":return a;case "object":return a;default:return ""}}
	function Ta(a){var b=a.type;return (a=a.nodeName)&&"input"===a.toLowerCase()&&("checkbox"===b||"radio"===b)}
	function Ua(a){var b=Ta(a)?"checked":"value",c=Object.getOwnPropertyDescriptor(a.constructor.prototype,b),d=""+a[b];if(!a.hasOwnProperty(b)&&"undefined"!==typeof c&&"function"===typeof c.get&&"function"===typeof c.set){var e=c.get,f=c.set;Object.defineProperty(a,b,{configurable:!0,get:function(){return e.call(this)},set:function(a){d=""+a;f.call(this,a);}});Object.defineProperty(a,b,{enumerable:c.enumerable});return {getValue:function(){return d},setValue:function(a){d=""+a;},stopTracking:function(){a._valueTracker=
	null;delete a[b];}}}}function Va(a){a._valueTracker||(a._valueTracker=Ua(a));}function Wa(a){if(!a)return !1;var b=a._valueTracker;if(!b)return !0;var c=b.getValue();var d="";a&&(d=Ta(a)?a.checked?"true":"false":a.value);a=d;return a!==c?(b.setValue(a),!0):!1}function Xa(a){a=a||("undefined"!==typeof document?document:void 0);if("undefined"===typeof a)return null;try{return a.activeElement||a.body}catch(b){return a.body}}
	function Ya(a,b){var c=b.checked;return A({},b,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:null!=c?c:a._wrapperState.initialChecked})}function Za(a,b){var c=null==b.defaultValue?"":b.defaultValue,d=null!=b.checked?b.checked:b.defaultChecked;c=Sa(null!=b.value?b.value:c);a._wrapperState={initialChecked:d,initialValue:c,controlled:"checkbox"===b.type||"radio"===b.type?null!=b.checked:null!=b.value};}function ab(a,b){b=b.checked;null!=b&&ta(a,"checked",b,!1);}
	function bb(a,b){ab(a,b);var c=Sa(b.value),d=b.type;if(null!=c)if("number"===d){if(0===c&&""===a.value||a.value!=c)a.value=""+c;}else a.value!==""+c&&(a.value=""+c);else if("submit"===d||"reset"===d){a.removeAttribute("value");return}b.hasOwnProperty("value")?cb(a,b.type,c):b.hasOwnProperty("defaultValue")&&cb(a,b.type,Sa(b.defaultValue));null==b.checked&&null!=b.defaultChecked&&(a.defaultChecked=!!b.defaultChecked);}
	function db(a,b,c){if(b.hasOwnProperty("value")||b.hasOwnProperty("defaultValue")){var d=b.type;if(!("submit"!==d&&"reset"!==d||void 0!==b.value&&null!==b.value))return;b=""+a._wrapperState.initialValue;c||b===a.value||(a.value=b);a.defaultValue=b;}c=a.name;""!==c&&(a.name="");a.defaultChecked=!!a._wrapperState.initialChecked;""!==c&&(a.name=c);}
	function cb(a,b,c){if("number"!==b||Xa(a.ownerDocument)!==a)null==c?a.defaultValue=""+a._wrapperState.initialValue:a.defaultValue!==""+c&&(a.defaultValue=""+c);}var eb=Array.isArray;
	function fb(a,b,c,d){a=a.options;if(b){b={};for(var e=0;e<c.length;e++)b["$"+c[e]]=!0;for(c=0;c<a.length;c++)e=b.hasOwnProperty("$"+a[c].value),a[c].selected!==e&&(a[c].selected=e),e&&d&&(a[c].defaultSelected=!0);}else {c=""+Sa(c);b=null;for(e=0;e<a.length;e++){if(a[e].value===c){a[e].selected=!0;d&&(a[e].defaultSelected=!0);return}null!==b||a[e].disabled||(b=a[e]);}null!==b&&(b.selected=!0);}}
	function gb(a,b){if(null!=b.dangerouslySetInnerHTML)throw Error(p$1(91));return A({},b,{value:void 0,defaultValue:void 0,children:""+a._wrapperState.initialValue})}function hb(a,b){var c=b.value;if(null==c){c=b.children;b=b.defaultValue;if(null!=c){if(null!=b)throw Error(p$1(92));if(eb(c)){if(1<c.length)throw Error(p$1(93));c=c[0];}b=c;}null==b&&(b="");c=b;}a._wrapperState={initialValue:Sa(c)};}
	function ib(a,b){var c=Sa(b.value),d=Sa(b.defaultValue);null!=c&&(c=""+c,c!==a.value&&(a.value=c),null==b.defaultValue&&a.defaultValue!==c&&(a.defaultValue=c));null!=d&&(a.defaultValue=""+d);}function jb(a){var b=a.textContent;b===a._wrapperState.initialValue&&""!==b&&null!==b&&(a.value=b);}function kb(a){switch(a){case "svg":return "http://www.w3.org/2000/svg";case "math":return "http://www.w3.org/1998/Math/MathML";default:return "http://www.w3.org/1999/xhtml"}}
	function lb(a,b){return null==a||"http://www.w3.org/1999/xhtml"===a?kb(b):"http://www.w3.org/2000/svg"===a&&"foreignObject"===b?"http://www.w3.org/1999/xhtml":a}
	var mb,nb=function(a){return "undefined"!==typeof MSApp&&MSApp.execUnsafeLocalFunction?function(b,c,d,e){MSApp.execUnsafeLocalFunction(function(){return a(b,c,d,e)});}:a}(function(a,b){if("http://www.w3.org/2000/svg"!==a.namespaceURI||"innerHTML"in a)a.innerHTML=b;else {mb=mb||document.createElement("div");mb.innerHTML="<svg>"+b.valueOf().toString()+"</svg>";for(b=mb.firstChild;a.firstChild;)a.removeChild(a.firstChild);for(;b.firstChild;)a.appendChild(b.firstChild);}});
	function ob(a,b){if(b){var c=a.firstChild;if(c&&c===a.lastChild&&3===c.nodeType){c.nodeValue=b;return}}a.textContent=b;}
	var pb={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,
	zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},qb=["Webkit","ms","Moz","O"];Object.keys(pb).forEach(function(a){qb.forEach(function(b){b=b+a.charAt(0).toUpperCase()+a.substring(1);pb[b]=pb[a];});});function rb(a,b,c){return null==b||"boolean"===typeof b||""===b?"":c||"number"!==typeof b||0===b||pb.hasOwnProperty(a)&&pb[a]?(""+b).trim():b+"px"}
	function sb(a,b){a=a.style;for(var c in b)if(b.hasOwnProperty(c)){var d=0===c.indexOf("--"),e=rb(c,b[c],d);"float"===c&&(c="cssFloat");d?a.setProperty(c,e):a[c]=e;}}var tb=A({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});
	function ub(a,b){if(b){if(tb[a]&&(null!=b.children||null!=b.dangerouslySetInnerHTML))throw Error(p$1(137,a));if(null!=b.dangerouslySetInnerHTML){if(null!=b.children)throw Error(p$1(60));if("object"!==typeof b.dangerouslySetInnerHTML||!("__html"in b.dangerouslySetInnerHTML))throw Error(p$1(61));}if(null!=b.style&&"object"!==typeof b.style)throw Error(p$1(62));}}
	function vb(a,b){if(-1===a.indexOf("-"))return "string"===typeof b.is;switch(a){case "annotation-xml":case "color-profile":case "font-face":case "font-face-src":case "font-face-uri":case "font-face-format":case "font-face-name":case "missing-glyph":return !1;default:return !0}}var wb=null;function xb(a){a=a.target||a.srcElement||window;a.correspondingUseElement&&(a=a.correspondingUseElement);return 3===a.nodeType?a.parentNode:a}var yb=null,zb=null,Ab=null;
	function Bb(a){if(a=Cb(a)){if("function"!==typeof yb)throw Error(p$1(280));var b=a.stateNode;b&&(b=Db(b),yb(a.stateNode,a.type,b));}}function Eb(a){zb?Ab?Ab.push(a):Ab=[a]:zb=a;}function Fb(){if(zb){var a=zb,b=Ab;Ab=zb=null;Bb(a);if(b)for(a=0;a<b.length;a++)Bb(b[a]);}}function Gb(a,b){return a(b)}function Hb(){}var Ib=!1;function Jb(a,b,c){if(Ib)return a(b,c);Ib=!0;try{return Gb(a,b,c)}finally{if(Ib=!1,null!==zb||null!==Ab)Hb(),Fb();}}
	function Kb(a,b){var c=a.stateNode;if(null===c)return null;var d=Db(c);if(null===d)return null;c=d[b];a:switch(b){case "onClick":case "onClickCapture":case "onDoubleClick":case "onDoubleClickCapture":case "onMouseDown":case "onMouseDownCapture":case "onMouseMove":case "onMouseMoveCapture":case "onMouseUp":case "onMouseUpCapture":case "onMouseEnter":(d=!d.disabled)||(a=a.type,d=!("button"===a||"input"===a||"select"===a||"textarea"===a));a=!d;break a;default:a=!1;}if(a)return null;if(c&&"function"!==
	typeof c)throw Error(p$1(231,b,typeof c));return c}var Lb=!1;if(ia)try{var Mb={};Object.defineProperty(Mb,"passive",{get:function(){Lb=!0;}});window.addEventListener("test",Mb,Mb);window.removeEventListener("test",Mb,Mb);}catch(a){Lb=!1;}function Nb(a,b,c,d,e,f,g,h,k){var l=Array.prototype.slice.call(arguments,3);try{b.apply(c,l);}catch(m){this.onError(m);}}var Ob=!1,Pb=null,Qb=!1,Rb=null,Sb={onError:function(a){Ob=!0;Pb=a;}};function Tb(a,b,c,d,e,f,g,h,k){Ob=!1;Pb=null;Nb.apply(Sb,arguments);}
	function Ub(a,b,c,d,e,f,g,h,k){Tb.apply(this,arguments);if(Ob){if(Ob){var l=Pb;Ob=!1;Pb=null;}else throw Error(p$1(198));Qb||(Qb=!0,Rb=l);}}function Vb(a){var b=a,c=a;if(a.alternate)for(;b.return;)b=b.return;else {a=b;do b=a,0!==(b.flags&4098)&&(c=b.return),a=b.return;while(a)}return 3===b.tag?c:null}function Wb(a){if(13===a.tag){var b=a.memoizedState;null===b&&(a=a.alternate,null!==a&&(b=a.memoizedState));if(null!==b)return b.dehydrated}return null}function Xb(a){if(Vb(a)!==a)throw Error(p$1(188));}
	function Yb(a){var b=a.alternate;if(!b){b=Vb(a);if(null===b)throw Error(p$1(188));return b!==a?null:a}for(var c=a,d=b;;){var e=c.return;if(null===e)break;var f=e.alternate;if(null===f){d=e.return;if(null!==d){c=d;continue}break}if(e.child===f.child){for(f=e.child;f;){if(f===c)return Xb(e),a;if(f===d)return Xb(e),b;f=f.sibling;}throw Error(p$1(188));}if(c.return!==d.return)c=e,d=f;else {for(var g=!1,h=e.child;h;){if(h===c){g=!0;c=e;d=f;break}if(h===d){g=!0;d=e;c=f;break}h=h.sibling;}if(!g){for(h=f.child;h;){if(h===
	c){g=!0;c=f;d=e;break}if(h===d){g=!0;d=f;c=e;break}h=h.sibling;}if(!g)throw Error(p$1(189));}}if(c.alternate!==d)throw Error(p$1(190));}if(3!==c.tag)throw Error(p$1(188));return c.stateNode.current===c?a:b}function Zb(a){a=Yb(a);return null!==a?$b(a):null}function $b(a){if(5===a.tag||6===a.tag)return a;for(a=a.child;null!==a;){var b=$b(a);if(null!==b)return b;a=a.sibling;}return null}
	var ac=ca.unstable_scheduleCallback,bc=ca.unstable_cancelCallback,cc=ca.unstable_shouldYield,dc=ca.unstable_requestPaint,B=ca.unstable_now,ec=ca.unstable_getCurrentPriorityLevel,fc=ca.unstable_ImmediatePriority,gc=ca.unstable_UserBlockingPriority,hc=ca.unstable_NormalPriority,ic=ca.unstable_LowPriority,jc=ca.unstable_IdlePriority,kc=null,lc=null;function mc(a){if(lc&&"function"===typeof lc.onCommitFiberRoot)try{lc.onCommitFiberRoot(kc,a,void 0,128===(a.current.flags&128));}catch(b){}}
	var oc=Math.clz32?Math.clz32:nc,pc=Math.log,qc=Math.LN2;function nc(a){a>>>=0;return 0===a?32:31-(pc(a)/qc|0)|0}var rc=64,sc=4194304;
	function tc(a){switch(a&-a){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return a&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return a&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;
	default:return a}}function uc(a,b){var c=a.pendingLanes;if(0===c)return 0;var d=0,e=a.suspendedLanes,f=a.pingedLanes,g=c&268435455;if(0!==g){var h=g&~e;0!==h?d=tc(h):(f&=g,0!==f&&(d=tc(f)));}else g=c&~e,0!==g?d=tc(g):0!==f&&(d=tc(f));if(0===d)return 0;if(0!==b&&b!==d&&0===(b&e)&&(e=d&-d,f=b&-b,e>=f||16===e&&0!==(f&4194240)))return b;0!==(d&4)&&(d|=c&16);b=a.entangledLanes;if(0!==b)for(a=a.entanglements,b&=d;0<b;)c=31-oc(b),e=1<<c,d|=a[c],b&=~e;return d}
	function vc(a,b){switch(a){case 1:case 2:case 4:return b+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return b+5E3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return -1;case 134217728:case 268435456:case 536870912:case 1073741824:return -1;default:return -1}}
	function wc(a,b){for(var c=a.suspendedLanes,d=a.pingedLanes,e=a.expirationTimes,f=a.pendingLanes;0<f;){var g=31-oc(f),h=1<<g,k=e[g];if(-1===k){if(0===(h&c)||0!==(h&d))e[g]=vc(h,b);}else k<=b&&(a.expiredLanes|=h);f&=~h;}}function xc(a){a=a.pendingLanes&-1073741825;return 0!==a?a:a&1073741824?1073741824:0}function yc(){var a=rc;rc<<=1;0===(rc&4194240)&&(rc=64);return a}function zc(a){for(var b=[],c=0;31>c;c++)b.push(a);return b}
	function Ac(a,b,c){a.pendingLanes|=b;536870912!==b&&(a.suspendedLanes=0,a.pingedLanes=0);a=a.eventTimes;b=31-oc(b);a[b]=c;}function Bc(a,b){var c=a.pendingLanes&~b;a.pendingLanes=b;a.suspendedLanes=0;a.pingedLanes=0;a.expiredLanes&=b;a.mutableReadLanes&=b;a.entangledLanes&=b;b=a.entanglements;var d=a.eventTimes;for(a=a.expirationTimes;0<c;){var e=31-oc(c),f=1<<e;b[e]=0;d[e]=-1;a[e]=-1;c&=~f;}}
	function Cc(a,b){var c=a.entangledLanes|=b;for(a=a.entanglements;c;){var d=31-oc(c),e=1<<d;e&b|a[d]&b&&(a[d]|=b);c&=~e;}}var C=0;function Dc(a){a&=-a;return 1<a?4<a?0!==(a&268435455)?16:536870912:4:1}var Ec,Fc,Gc,Hc,Ic,Jc=!1,Kc=[],Lc=null,Mc=null,Nc=null,Oc=new Map,Pc=new Map,Qc=[],Rc="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
	function Sc(a,b){switch(a){case "focusin":case "focusout":Lc=null;break;case "dragenter":case "dragleave":Mc=null;break;case "mouseover":case "mouseout":Nc=null;break;case "pointerover":case "pointerout":Oc.delete(b.pointerId);break;case "gotpointercapture":case "lostpointercapture":Pc.delete(b.pointerId);}}
	function Tc(a,b,c,d,e,f){if(null===a||a.nativeEvent!==f)return a={blockedOn:b,domEventName:c,eventSystemFlags:d,nativeEvent:f,targetContainers:[e]},null!==b&&(b=Cb(b),null!==b&&Fc(b)),a;a.eventSystemFlags|=d;b=a.targetContainers;null!==e&&-1===b.indexOf(e)&&b.push(e);return a}
	function Uc(a,b,c,d,e){switch(b){case "focusin":return Lc=Tc(Lc,a,b,c,d,e),!0;case "dragenter":return Mc=Tc(Mc,a,b,c,d,e),!0;case "mouseover":return Nc=Tc(Nc,a,b,c,d,e),!0;case "pointerover":var f=e.pointerId;Oc.set(f,Tc(Oc.get(f)||null,a,b,c,d,e));return !0;case "gotpointercapture":return f=e.pointerId,Pc.set(f,Tc(Pc.get(f)||null,a,b,c,d,e)),!0}return !1}
	function Vc(a){var b=Wc(a.target);if(null!==b){var c=Vb(b);if(null!==c)if(b=c.tag,13===b){if(b=Wb(c),null!==b){a.blockedOn=b;Ic(a.priority,function(){Gc(c);});return}}else if(3===b&&c.stateNode.current.memoizedState.isDehydrated){a.blockedOn=3===c.tag?c.stateNode.containerInfo:null;return}}a.blockedOn=null;}
	function Xc(a){if(null!==a.blockedOn)return !1;for(var b=a.targetContainers;0<b.length;){var c=Yc(a.domEventName,a.eventSystemFlags,b[0],a.nativeEvent);if(null===c){c=a.nativeEvent;var d=new c.constructor(c.type,c);wb=d;c.target.dispatchEvent(d);wb=null;}else return b=Cb(c),null!==b&&Fc(b),a.blockedOn=c,!1;b.shift();}return !0}function Zc(a,b,c){Xc(a)&&c.delete(b);}function $c(){Jc=!1;null!==Lc&&Xc(Lc)&&(Lc=null);null!==Mc&&Xc(Mc)&&(Mc=null);null!==Nc&&Xc(Nc)&&(Nc=null);Oc.forEach(Zc);Pc.forEach(Zc);}
	function ad(a,b){a.blockedOn===b&&(a.blockedOn=null,Jc||(Jc=!0,ca.unstable_scheduleCallback(ca.unstable_NormalPriority,$c)));}
	function bd(a){function b(b){return ad(b,a)}if(0<Kc.length){ad(Kc[0],a);for(var c=1;c<Kc.length;c++){var d=Kc[c];d.blockedOn===a&&(d.blockedOn=null);}}null!==Lc&&ad(Lc,a);null!==Mc&&ad(Mc,a);null!==Nc&&ad(Nc,a);Oc.forEach(b);Pc.forEach(b);for(c=0;c<Qc.length;c++)d=Qc[c],d.blockedOn===a&&(d.blockedOn=null);for(;0<Qc.length&&(c=Qc[0],null===c.blockedOn);)Vc(c),null===c.blockedOn&&Qc.shift();}var cd=ua.ReactCurrentBatchConfig,dd=!0;
	function ed(a,b,c,d){var e=C,f=cd.transition;cd.transition=null;try{C=1,fd(a,b,c,d);}finally{C=e,cd.transition=f;}}function gd(a,b,c,d){var e=C,f=cd.transition;cd.transition=null;try{C=4,fd(a,b,c,d);}finally{C=e,cd.transition=f;}}
	function fd(a,b,c,d){if(dd){var e=Yc(a,b,c,d);if(null===e)hd(a,b,d,id,c),Sc(a,d);else if(Uc(e,a,b,c,d))d.stopPropagation();else if(Sc(a,d),b&4&&-1<Rc.indexOf(a)){for(;null!==e;){var f=Cb(e);null!==f&&Ec(f);f=Yc(a,b,c,d);null===f&&hd(a,b,d,id,c);if(f===e)break;e=f;}null!==e&&d.stopPropagation();}else hd(a,b,d,null,c);}}var id=null;
	function Yc(a,b,c,d){id=null;a=xb(d);a=Wc(a);if(null!==a)if(b=Vb(a),null===b)a=null;else if(c=b.tag,13===c){a=Wb(b);if(null!==a)return a;a=null;}else if(3===c){if(b.stateNode.current.memoizedState.isDehydrated)return 3===b.tag?b.stateNode.containerInfo:null;a=null;}else b!==a&&(a=null);id=a;return null}
	function jd(a){switch(a){case "cancel":case "click":case "close":case "contextmenu":case "copy":case "cut":case "auxclick":case "dblclick":case "dragend":case "dragstart":case "drop":case "focusin":case "focusout":case "input":case "invalid":case "keydown":case "keypress":case "keyup":case "mousedown":case "mouseup":case "paste":case "pause":case "play":case "pointercancel":case "pointerdown":case "pointerup":case "ratechange":case "reset":case "resize":case "seeked":case "submit":case "touchcancel":case "touchend":case "touchstart":case "volumechange":case "change":case "selectionchange":case "textInput":case "compositionstart":case "compositionend":case "compositionupdate":case "beforeblur":case "afterblur":case "beforeinput":case "blur":case "fullscreenchange":case "focus":case "hashchange":case "popstate":case "select":case "selectstart":return 1;case "drag":case "dragenter":case "dragexit":case "dragleave":case "dragover":case "mousemove":case "mouseout":case "mouseover":case "pointermove":case "pointerout":case "pointerover":case "scroll":case "toggle":case "touchmove":case "wheel":case "mouseenter":case "mouseleave":case "pointerenter":case "pointerleave":return 4;
	case "message":switch(ec()){case fc:return 1;case gc:return 4;case hc:case ic:return 16;case jc:return 536870912;default:return 16}default:return 16}}var kd=null,ld=null,md=null;function nd(){if(md)return md;var a,b=ld,c=b.length,d,e="value"in kd?kd.value:kd.textContent,f=e.length;for(a=0;a<c&&b[a]===e[a];a++);var g=c-a;for(d=1;d<=g&&b[c-d]===e[f-d];d++);return md=e.slice(a,1<d?1-d:void 0)}
	function od(a){var b=a.keyCode;"charCode"in a?(a=a.charCode,0===a&&13===b&&(a=13)):a=b;10===a&&(a=13);return 32<=a||13===a?a:0}function pd(){return !0}function qd(){return !1}
	function rd(a){function b(b,d,e,f,g){this._reactName=b;this._targetInst=e;this.type=d;this.nativeEvent=f;this.target=g;this.currentTarget=null;for(var c in a)a.hasOwnProperty(c)&&(b=a[c],this[c]=b?b(f):f[c]);this.isDefaultPrevented=(null!=f.defaultPrevented?f.defaultPrevented:!1===f.returnValue)?pd:qd;this.isPropagationStopped=qd;return this}A(b.prototype,{preventDefault:function(){this.defaultPrevented=!0;var a=this.nativeEvent;a&&(a.preventDefault?a.preventDefault():"unknown"!==typeof a.returnValue&&
	(a.returnValue=!1),this.isDefaultPrevented=pd);},stopPropagation:function(){var a=this.nativeEvent;a&&(a.stopPropagation?a.stopPropagation():"unknown"!==typeof a.cancelBubble&&(a.cancelBubble=!0),this.isPropagationStopped=pd);},persist:function(){},isPersistent:pd});return b}
	var sd={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(a){return a.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},td=rd(sd),ud=A({},sd,{view:0,detail:0}),vd=rd(ud),wd,xd,yd,Ad=A({},ud,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:zd,button:0,buttons:0,relatedTarget:function(a){return void 0===a.relatedTarget?a.fromElement===a.srcElement?a.toElement:a.fromElement:a.relatedTarget},movementX:function(a){if("movementX"in
	a)return a.movementX;a!==yd&&(yd&&"mousemove"===a.type?(wd=a.screenX-yd.screenX,xd=a.screenY-yd.screenY):xd=wd=0,yd=a);return wd},movementY:function(a){return "movementY"in a?a.movementY:xd}}),Bd=rd(Ad),Cd=A({},Ad,{dataTransfer:0}),Dd=rd(Cd),Ed=A({},ud,{relatedTarget:0}),Fd=rd(Ed),Gd=A({},sd,{animationName:0,elapsedTime:0,pseudoElement:0}),Hd=rd(Gd),Id=A({},sd,{clipboardData:function(a){return "clipboardData"in a?a.clipboardData:window.clipboardData}}),Jd=rd(Id),Kd=A({},sd,{data:0}),Ld=rd(Kd),Md={Esc:"Escape",
	Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Nd={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",
	119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},Od={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Pd(a){var b=this.nativeEvent;return b.getModifierState?b.getModifierState(a):(a=Od[a])?!!b[a]:!1}function zd(){return Pd}
	var Qd=A({},ud,{key:function(a){if(a.key){var b=Md[a.key]||a.key;if("Unidentified"!==b)return b}return "keypress"===a.type?(a=od(a),13===a?"Enter":String.fromCharCode(a)):"keydown"===a.type||"keyup"===a.type?Nd[a.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:zd,charCode:function(a){return "keypress"===a.type?od(a):0},keyCode:function(a){return "keydown"===a.type||"keyup"===a.type?a.keyCode:0},which:function(a){return "keypress"===
	a.type?od(a):"keydown"===a.type||"keyup"===a.type?a.keyCode:0}}),Rd=rd(Qd),Sd=A({},Ad,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Td=rd(Sd),Ud=A({},ud,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:zd}),Vd=rd(Ud),Wd=A({},sd,{propertyName:0,elapsedTime:0,pseudoElement:0}),Xd=rd(Wd),Yd=A({},Ad,{deltaX:function(a){return "deltaX"in a?a.deltaX:"wheelDeltaX"in a?-a.wheelDeltaX:0},
	deltaY:function(a){return "deltaY"in a?a.deltaY:"wheelDeltaY"in a?-a.wheelDeltaY:"wheelDelta"in a?-a.wheelDelta:0},deltaZ:0,deltaMode:0}),Zd=rd(Yd),$d=[9,13,27,32],ae=ia&&"CompositionEvent"in window,be=null;ia&&"documentMode"in document&&(be=document.documentMode);var ce=ia&&"TextEvent"in window&&!be,de=ia&&(!ae||be&&8<be&&11>=be),ee=String.fromCharCode(32),fe=!1;
	function ge(a,b){switch(a){case "keyup":return -1!==$d.indexOf(b.keyCode);case "keydown":return 229!==b.keyCode;case "keypress":case "mousedown":case "focusout":return !0;default:return !1}}function he(a){a=a.detail;return "object"===typeof a&&"data"in a?a.data:null}var ie=!1;function je(a,b){switch(a){case "compositionend":return he(b);case "keypress":if(32!==b.which)return null;fe=!0;return ee;case "textInput":return a=b.data,a===ee&&fe?null:a;default:return null}}
	function ke(a,b){if(ie)return "compositionend"===a||!ae&&ge(a,b)?(a=nd(),md=ld=kd=null,ie=!1,a):null;switch(a){case "paste":return null;case "keypress":if(!(b.ctrlKey||b.altKey||b.metaKey)||b.ctrlKey&&b.altKey){if(b.char&&1<b.char.length)return b.char;if(b.which)return String.fromCharCode(b.which)}return null;case "compositionend":return de&&"ko"!==b.locale?null:b.data;default:return null}}
	var le={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function me(a){var b=a&&a.nodeName&&a.nodeName.toLowerCase();return "input"===b?!!le[a.type]:"textarea"===b?!0:!1}function ne(a,b,c,d){Eb(d);b=oe(b,"onChange");0<b.length&&(c=new td("onChange","change",null,c,d),a.push({event:c,listeners:b}));}var pe=null,qe=null;function re(a){se(a,0);}function te(a){var b=ue(a);if(Wa(b))return a}
	function ve(a,b){if("change"===a)return b}var we=!1;if(ia){var xe;if(ia){var ye="oninput"in document;if(!ye){var ze=document.createElement("div");ze.setAttribute("oninput","return;");ye="function"===typeof ze.oninput;}xe=ye;}else xe=!1;we=xe&&(!document.documentMode||9<document.documentMode);}function Ae(){pe&&(pe.detachEvent("onpropertychange",Be),qe=pe=null);}function Be(a){if("value"===a.propertyName&&te(qe)){var b=[];ne(b,qe,a,xb(a));Jb(re,b);}}
	function Ce(a,b,c){"focusin"===a?(Ae(),pe=b,qe=c,pe.attachEvent("onpropertychange",Be)):"focusout"===a&&Ae();}function De(a){if("selectionchange"===a||"keyup"===a||"keydown"===a)return te(qe)}function Ee(a,b){if("click"===a)return te(b)}function Fe(a,b){if("input"===a||"change"===a)return te(b)}function Ge(a,b){return a===b&&(0!==a||1/a===1/b)||a!==a&&b!==b}var He="function"===typeof Object.is?Object.is:Ge;
	function Ie(a,b){if(He(a,b))return !0;if("object"!==typeof a||null===a||"object"!==typeof b||null===b)return !1;var c=Object.keys(a),d=Object.keys(b);if(c.length!==d.length)return !1;for(d=0;d<c.length;d++){var e=c[d];if(!ja.call(b,e)||!He(a[e],b[e]))return !1}return !0}function Je(a){for(;a&&a.firstChild;)a=a.firstChild;return a}
	function Ke(a,b){var c=Je(a);a=0;for(var d;c;){if(3===c.nodeType){d=a+c.textContent.length;if(a<=b&&d>=b)return {node:c,offset:b-a};a=d;}a:{for(;c;){if(c.nextSibling){c=c.nextSibling;break a}c=c.parentNode;}c=void 0;}c=Je(c);}}function Le(a,b){return a&&b?a===b?!0:a&&3===a.nodeType?!1:b&&3===b.nodeType?Le(a,b.parentNode):"contains"in a?a.contains(b):a.compareDocumentPosition?!!(a.compareDocumentPosition(b)&16):!1:!1}
	function Me(){for(var a=window,b=Xa();b instanceof a.HTMLIFrameElement;){try{var c="string"===typeof b.contentWindow.location.href;}catch(d){c=!1;}if(c)a=b.contentWindow;else break;b=Xa(a.document);}return b}function Ne(a){var b=a&&a.nodeName&&a.nodeName.toLowerCase();return b&&("input"===b&&("text"===a.type||"search"===a.type||"tel"===a.type||"url"===a.type||"password"===a.type)||"textarea"===b||"true"===a.contentEditable)}
	function Oe(a){var b=Me(),c=a.focusedElem,d=a.selectionRange;if(b!==c&&c&&c.ownerDocument&&Le(c.ownerDocument.documentElement,c)){if(null!==d&&Ne(c))if(b=d.start,a=d.end,void 0===a&&(a=b),"selectionStart"in c)c.selectionStart=b,c.selectionEnd=Math.min(a,c.value.length);else if(a=(b=c.ownerDocument||document)&&b.defaultView||window,a.getSelection){a=a.getSelection();var e=c.textContent.length,f=Math.min(d.start,e);d=void 0===d.end?f:Math.min(d.end,e);!a.extend&&f>d&&(e=d,d=f,f=e);e=Ke(c,f);var g=Ke(c,
	d);e&&g&&(1!==a.rangeCount||a.anchorNode!==e.node||a.anchorOffset!==e.offset||a.focusNode!==g.node||a.focusOffset!==g.offset)&&(b=b.createRange(),b.setStart(e.node,e.offset),a.removeAllRanges(),f>d?(a.addRange(b),a.extend(g.node,g.offset)):(b.setEnd(g.node,g.offset),a.addRange(b)));}b=[];for(a=c;a=a.parentNode;)1===a.nodeType&&b.push({element:a,left:a.scrollLeft,top:a.scrollTop});"function"===typeof c.focus&&c.focus();for(c=0;c<b.length;c++)a=b[c],a.element.scrollLeft=a.left,a.element.scrollTop=a.top;}}
	var Pe=ia&&"documentMode"in document&&11>=document.documentMode,Qe=null,Re=null,Se=null,Te=!1;
	function Ue(a,b,c){var d=c.window===c?c.document:9===c.nodeType?c:c.ownerDocument;Te||null==Qe||Qe!==Xa(d)||(d=Qe,"selectionStart"in d&&Ne(d)?d={start:d.selectionStart,end:d.selectionEnd}:(d=(d.ownerDocument&&d.ownerDocument.defaultView||window).getSelection(),d={anchorNode:d.anchorNode,anchorOffset:d.anchorOffset,focusNode:d.focusNode,focusOffset:d.focusOffset}),Se&&Ie(Se,d)||(Se=d,d=oe(Re,"onSelect"),0<d.length&&(b=new td("onSelect","select",null,b,c),a.push({event:b,listeners:d}),b.target=Qe)));}
	function Ve(a,b){var c={};c[a.toLowerCase()]=b.toLowerCase();c["Webkit"+a]="webkit"+b;c["Moz"+a]="moz"+b;return c}var We={animationend:Ve("Animation","AnimationEnd"),animationiteration:Ve("Animation","AnimationIteration"),animationstart:Ve("Animation","AnimationStart"),transitionend:Ve("Transition","TransitionEnd")},Xe={},Ye={};
	ia&&(Ye=document.createElement("div").style,"AnimationEvent"in window||(delete We.animationend.animation,delete We.animationiteration.animation,delete We.animationstart.animation),"TransitionEvent"in window||delete We.transitionend.transition);function Ze(a){if(Xe[a])return Xe[a];if(!We[a])return a;var b=We[a],c;for(c in b)if(b.hasOwnProperty(c)&&c in Ye)return Xe[a]=b[c];return a}var $e=Ze("animationend"),af=Ze("animationiteration"),bf=Ze("animationstart"),cf=Ze("transitionend"),df=new Map,ef="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	function ff(a,b){df.set(a,b);fa(b,[a]);}for(var gf=0;gf<ef.length;gf++){var hf=ef[gf],jf=hf.toLowerCase(),kf=hf[0].toUpperCase()+hf.slice(1);ff(jf,"on"+kf);}ff($e,"onAnimationEnd");ff(af,"onAnimationIteration");ff(bf,"onAnimationStart");ff("dblclick","onDoubleClick");ff("focusin","onFocus");ff("focusout","onBlur");ff(cf,"onTransitionEnd");ha("onMouseEnter",["mouseout","mouseover"]);ha("onMouseLeave",["mouseout","mouseover"]);ha("onPointerEnter",["pointerout","pointerover"]);
	ha("onPointerLeave",["pointerout","pointerover"]);fa("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));fa("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));fa("onBeforeInput",["compositionend","keypress","textInput","paste"]);fa("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));fa("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));
	fa("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var lf="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),mf=new Set("cancel close invalid load scroll toggle".split(" ").concat(lf));
	function nf(a,b,c){var d=a.type||"unknown-event";a.currentTarget=c;Ub(d,b,void 0,a);a.currentTarget=null;}
	function se(a,b){b=0!==(b&4);for(var c=0;c<a.length;c++){var d=a[c],e=d.event;d=d.listeners;a:{var f=void 0;if(b)for(var g=d.length-1;0<=g;g--){var h=d[g],k=h.instance,l=h.currentTarget;h=h.listener;if(k!==f&&e.isPropagationStopped())break a;nf(e,h,l);f=k;}else for(g=0;g<d.length;g++){h=d[g];k=h.instance;l=h.currentTarget;h=h.listener;if(k!==f&&e.isPropagationStopped())break a;nf(e,h,l);f=k;}}}if(Qb)throw a=Rb,Qb=!1,Rb=null,a;}
	function D(a,b){var c=b[of];void 0===c&&(c=b[of]=new Set);var d=a+"__bubble";c.has(d)||(pf(b,a,2,!1),c.add(d));}function qf(a,b,c){var d=0;b&&(d|=4);pf(c,a,d,b);}var rf="_reactListening"+Math.random().toString(36).slice(2);function sf(a){if(!a[rf]){a[rf]=!0;da.forEach(function(b){"selectionchange"!==b&&(mf.has(b)||qf(b,!1,a),qf(b,!0,a));});var b=9===a.nodeType?a:a.ownerDocument;null===b||b[rf]||(b[rf]=!0,qf("selectionchange",!1,b));}}
	function pf(a,b,c,d){switch(jd(b)){case 1:var e=ed;break;case 4:e=gd;break;default:e=fd;}c=e.bind(null,b,c,a);e=void 0;!Lb||"touchstart"!==b&&"touchmove"!==b&&"wheel"!==b||(e=!0);d?void 0!==e?a.addEventListener(b,c,{capture:!0,passive:e}):a.addEventListener(b,c,!0):void 0!==e?a.addEventListener(b,c,{passive:e}):a.addEventListener(b,c,!1);}
	function hd(a,b,c,d,e){var f=d;if(0===(b&1)&&0===(b&2)&&null!==d)a:for(;;){if(null===d)return;var g=d.tag;if(3===g||4===g){var h=d.stateNode.containerInfo;if(h===e||8===h.nodeType&&h.parentNode===e)break;if(4===g)for(g=d.return;null!==g;){var k=g.tag;if(3===k||4===k)if(k=g.stateNode.containerInfo,k===e||8===k.nodeType&&k.parentNode===e)return;g=g.return;}for(;null!==h;){g=Wc(h);if(null===g)return;k=g.tag;if(5===k||6===k){d=f=g;continue a}h=h.parentNode;}}d=d.return;}Jb(function(){var d=f,e=xb(c),g=[];
	a:{var h=df.get(a);if(void 0!==h){var k=td,n=a;switch(a){case "keypress":if(0===od(c))break a;case "keydown":case "keyup":k=Rd;break;case "focusin":n="focus";k=Fd;break;case "focusout":n="blur";k=Fd;break;case "beforeblur":case "afterblur":k=Fd;break;case "click":if(2===c.button)break a;case "auxclick":case "dblclick":case "mousedown":case "mousemove":case "mouseup":case "mouseout":case "mouseover":case "contextmenu":k=Bd;break;case "drag":case "dragend":case "dragenter":case "dragexit":case "dragleave":case "dragover":case "dragstart":case "drop":k=
	Dd;break;case "touchcancel":case "touchend":case "touchmove":case "touchstart":k=Vd;break;case $e:case af:case bf:k=Hd;break;case cf:k=Xd;break;case "scroll":k=vd;break;case "wheel":k=Zd;break;case "copy":case "cut":case "paste":k=Jd;break;case "gotpointercapture":case "lostpointercapture":case "pointercancel":case "pointerdown":case "pointermove":case "pointerout":case "pointerover":case "pointerup":k=Td;}var t=0!==(b&4),J=!t&&"scroll"===a,x=t?null!==h?h+"Capture":null:h;t=[];for(var w=d,u;null!==
	w;){u=w;var F=u.stateNode;5===u.tag&&null!==F&&(u=F,null!==x&&(F=Kb(w,x),null!=F&&t.push(tf(w,F,u))));if(J)break;w=w.return;}0<t.length&&(h=new k(h,n,null,c,e),g.push({event:h,listeners:t}));}}if(0===(b&7)){a:{h="mouseover"===a||"pointerover"===a;k="mouseout"===a||"pointerout"===a;if(h&&c!==wb&&(n=c.relatedTarget||c.fromElement)&&(Wc(n)||n[uf]))break a;if(k||h){h=e.window===e?e:(h=e.ownerDocument)?h.defaultView||h.parentWindow:window;if(k){if(n=c.relatedTarget||c.toElement,k=d,n=n?Wc(n):null,null!==
	n&&(J=Vb(n),n!==J||5!==n.tag&&6!==n.tag))n=null;}else k=null,n=d;if(k!==n){t=Bd;F="onMouseLeave";x="onMouseEnter";w="mouse";if("pointerout"===a||"pointerover"===a)t=Td,F="onPointerLeave",x="onPointerEnter",w="pointer";J=null==k?h:ue(k);u=null==n?h:ue(n);h=new t(F,w+"leave",k,c,e);h.target=J;h.relatedTarget=u;F=null;Wc(e)===d&&(t=new t(x,w+"enter",n,c,e),t.target=u,t.relatedTarget=J,F=t);J=F;if(k&&n)b:{t=k;x=n;w=0;for(u=t;u;u=vf(u))w++;u=0;for(F=x;F;F=vf(F))u++;for(;0<w-u;)t=vf(t),w--;for(;0<u-w;)x=
	vf(x),u--;for(;w--;){if(t===x||null!==x&&t===x.alternate)break b;t=vf(t);x=vf(x);}t=null;}else t=null;null!==k&&wf(g,h,k,t,!1);null!==n&&null!==J&&wf(g,J,n,t,!0);}}}a:{h=d?ue(d):window;k=h.nodeName&&h.nodeName.toLowerCase();if("select"===k||"input"===k&&"file"===h.type)var na=ve;else if(me(h))if(we)na=Fe;else {na=De;var xa=Ce;}else (k=h.nodeName)&&"input"===k.toLowerCase()&&("checkbox"===h.type||"radio"===h.type)&&(na=Ee);if(na&&(na=na(a,d))){ne(g,na,c,e);break a}xa&&xa(a,h,d);"focusout"===a&&(xa=h._wrapperState)&&
	xa.controlled&&"number"===h.type&&cb(h,"number",h.value);}xa=d?ue(d):window;switch(a){case "focusin":if(me(xa)||"true"===xa.contentEditable)Qe=xa,Re=d,Se=null;break;case "focusout":Se=Re=Qe=null;break;case "mousedown":Te=!0;break;case "contextmenu":case "mouseup":case "dragend":Te=!1;Ue(g,c,e);break;case "selectionchange":if(Pe)break;case "keydown":case "keyup":Ue(g,c,e);}var $a;if(ae)b:{switch(a){case "compositionstart":var ba="onCompositionStart";break b;case "compositionend":ba="onCompositionEnd";
	break b;case "compositionupdate":ba="onCompositionUpdate";break b}ba=void 0;}else ie?ge(a,c)&&(ba="onCompositionEnd"):"keydown"===a&&229===c.keyCode&&(ba="onCompositionStart");ba&&(de&&"ko"!==c.locale&&(ie||"onCompositionStart"!==ba?"onCompositionEnd"===ba&&ie&&($a=nd()):(kd=e,ld="value"in kd?kd.value:kd.textContent,ie=!0)),xa=oe(d,ba),0<xa.length&&(ba=new Ld(ba,a,null,c,e),g.push({event:ba,listeners:xa}),$a?ba.data=$a:($a=he(c),null!==$a&&(ba.data=$a))));if($a=ce?je(a,c):ke(a,c))d=oe(d,"onBeforeInput"),
	0<d.length&&(e=new Ld("onBeforeInput","beforeinput",null,c,e),g.push({event:e,listeners:d}),e.data=$a);}se(g,b);});}function tf(a,b,c){return {instance:a,listener:b,currentTarget:c}}function oe(a,b){for(var c=b+"Capture",d=[];null!==a;){var e=a,f=e.stateNode;5===e.tag&&null!==f&&(e=f,f=Kb(a,c),null!=f&&d.unshift(tf(a,f,e)),f=Kb(a,b),null!=f&&d.push(tf(a,f,e)));a=a.return;}return d}function vf(a){if(null===a)return null;do a=a.return;while(a&&5!==a.tag);return a?a:null}
	function wf(a,b,c,d,e){for(var f=b._reactName,g=[];null!==c&&c!==d;){var h=c,k=h.alternate,l=h.stateNode;if(null!==k&&k===d)break;5===h.tag&&null!==l&&(h=l,e?(k=Kb(c,f),null!=k&&g.unshift(tf(c,k,h))):e||(k=Kb(c,f),null!=k&&g.push(tf(c,k,h))));c=c.return;}0!==g.length&&a.push({event:b,listeners:g});}var xf=/\r\n?/g,yf=/\u0000|\uFFFD/g;function zf(a){return ("string"===typeof a?a:""+a).replace(xf,"\n").replace(yf,"")}function Af(a,b,c){b=zf(b);if(zf(a)!==b&&c)throw Error(p$1(425));}function Bf(){}
	var Cf=null,Df=null;function Ef(a,b){return "textarea"===a||"noscript"===a||"string"===typeof b.children||"number"===typeof b.children||"object"===typeof b.dangerouslySetInnerHTML&&null!==b.dangerouslySetInnerHTML&&null!=b.dangerouslySetInnerHTML.__html}
	var Ff="function"===typeof setTimeout?setTimeout:void 0,Gf="function"===typeof clearTimeout?clearTimeout:void 0,Hf="function"===typeof Promise?Promise:void 0,Jf="function"===typeof queueMicrotask?queueMicrotask:"undefined"!==typeof Hf?function(a){return Hf.resolve(null).then(a).catch(If)}:Ff;function If(a){setTimeout(function(){throw a;});}
	function Kf(a,b){var c=b,d=0;do{var e=c.nextSibling;a.removeChild(c);if(e&&8===e.nodeType)if(c=e.data,"/$"===c){if(0===d){a.removeChild(e);bd(b);return}d--;}else "$"!==c&&"$?"!==c&&"$!"!==c||d++;c=e;}while(c);bd(b);}function Lf(a){for(;null!=a;a=a.nextSibling){var b=a.nodeType;if(1===b||3===b)break;if(8===b){b=a.data;if("$"===b||"$!"===b||"$?"===b)break;if("/$"===b)return null}}return a}
	function Mf(a){a=a.previousSibling;for(var b=0;a;){if(8===a.nodeType){var c=a.data;if("$"===c||"$!"===c||"$?"===c){if(0===b)return a;b--;}else "/$"===c&&b++;}a=a.previousSibling;}return null}var Nf=Math.random().toString(36).slice(2),Of="__reactFiber$"+Nf,Pf="__reactProps$"+Nf,uf="__reactContainer$"+Nf,of="__reactEvents$"+Nf,Qf="__reactListeners$"+Nf,Rf="__reactHandles$"+Nf;
	function Wc(a){var b=a[Of];if(b)return b;for(var c=a.parentNode;c;){if(b=c[uf]||c[Of]){c=b.alternate;if(null!==b.child||null!==c&&null!==c.child)for(a=Mf(a);null!==a;){if(c=a[Of])return c;a=Mf(a);}return b}a=c;c=a.parentNode;}return null}function Cb(a){a=a[Of]||a[uf];return !a||5!==a.tag&&6!==a.tag&&13!==a.tag&&3!==a.tag?null:a}function ue(a){if(5===a.tag||6===a.tag)return a.stateNode;throw Error(p$1(33));}function Db(a){return a[Pf]||null}var Sf=[],Tf=-1;function Uf(a){return {current:a}}
	function E(a){0>Tf||(a.current=Sf[Tf],Sf[Tf]=null,Tf--);}function G(a,b){Tf++;Sf[Tf]=a.current;a.current=b;}var Vf={},H=Uf(Vf),Wf=Uf(!1),Xf=Vf;function Yf(a,b){var c=a.type.contextTypes;if(!c)return Vf;var d=a.stateNode;if(d&&d.__reactInternalMemoizedUnmaskedChildContext===b)return d.__reactInternalMemoizedMaskedChildContext;var e={},f;for(f in c)e[f]=b[f];d&&(a=a.stateNode,a.__reactInternalMemoizedUnmaskedChildContext=b,a.__reactInternalMemoizedMaskedChildContext=e);return e}
	function Zf(a){a=a.childContextTypes;return null!==a&&void 0!==a}function $f(){E(Wf);E(H);}function ag(a,b,c){if(H.current!==Vf)throw Error(p$1(168));G(H,b);G(Wf,c);}function bg(a,b,c){var d=a.stateNode;b=b.childContextTypes;if("function"!==typeof d.getChildContext)return c;d=d.getChildContext();for(var e in d)if(!(e in b))throw Error(p$1(108,Ra(a)||"Unknown",e));return A({},c,d)}
	function cg(a){a=(a=a.stateNode)&&a.__reactInternalMemoizedMergedChildContext||Vf;Xf=H.current;G(H,a);G(Wf,Wf.current);return !0}function dg(a,b,c){var d=a.stateNode;if(!d)throw Error(p$1(169));c?(a=bg(a,b,Xf),d.__reactInternalMemoizedMergedChildContext=a,E(Wf),E(H),G(H,a)):E(Wf);G(Wf,c);}var eg=null,fg=!1,gg=!1;function hg(a){null===eg?eg=[a]:eg.push(a);}function ig(a){fg=!0;hg(a);}
	function jg(){if(!gg&&null!==eg){gg=!0;var a=0,b=C;try{var c=eg;for(C=1;a<c.length;a++){var d=c[a];do d=d(!0);while(null!==d)}eg=null;fg=!1;}catch(e){throw null!==eg&&(eg=eg.slice(a+1)),ac(fc,jg),e;}finally{C=b,gg=!1;}}return null}var kg=[],lg=0,mg=null,ng=0,og=[],pg=0,qg=null,rg=1,sg="";function tg(a,b){kg[lg++]=ng;kg[lg++]=mg;mg=a;ng=b;}
	function ug(a,b,c){og[pg++]=rg;og[pg++]=sg;og[pg++]=qg;qg=a;var d=rg;a=sg;var e=32-oc(d)-1;d&=~(1<<e);c+=1;var f=32-oc(b)+e;if(30<f){var g=e-e%5;f=(d&(1<<g)-1).toString(32);d>>=g;e-=g;rg=1<<32-oc(b)+e|c<<e|d;sg=f+a;}else rg=1<<f|c<<e|d,sg=a;}function vg(a){null!==a.return&&(tg(a,1),ug(a,1,0));}function wg(a){for(;a===mg;)mg=kg[--lg],kg[lg]=null,ng=kg[--lg],kg[lg]=null;for(;a===qg;)qg=og[--pg],og[pg]=null,sg=og[--pg],og[pg]=null,rg=og[--pg],og[pg]=null;}var xg=null,yg=null,I=!1,zg=null;
	function Ag(a,b){var c=Bg(5,null,null,0);c.elementType="DELETED";c.stateNode=b;c.return=a;b=a.deletions;null===b?(a.deletions=[c],a.flags|=16):b.push(c);}
	function Cg(a,b){switch(a.tag){case 5:var c=a.type;b=1!==b.nodeType||c.toLowerCase()!==b.nodeName.toLowerCase()?null:b;return null!==b?(a.stateNode=b,xg=a,yg=Lf(b.firstChild),!0):!1;case 6:return b=""===a.pendingProps||3!==b.nodeType?null:b,null!==b?(a.stateNode=b,xg=a,yg=null,!0):!1;case 13:return b=8!==b.nodeType?null:b,null!==b?(c=null!==qg?{id:rg,overflow:sg}:null,a.memoizedState={dehydrated:b,treeContext:c,retryLane:1073741824},c=Bg(18,null,null,0),c.stateNode=b,c.return=a,a.child=c,xg=a,yg=
	null,!0):!1;default:return !1}}function Dg(a){return 0!==(a.mode&1)&&0===(a.flags&128)}function Eg(a){if(I){var b=yg;if(b){var c=b;if(!Cg(a,b)){if(Dg(a))throw Error(p$1(418));b=Lf(c.nextSibling);var d=xg;b&&Cg(a,b)?Ag(d,c):(a.flags=a.flags&-4097|2,I=!1,xg=a);}}else {if(Dg(a))throw Error(p$1(418));a.flags=a.flags&-4097|2;I=!1;xg=a;}}}function Fg(a){for(a=a.return;null!==a&&5!==a.tag&&3!==a.tag&&13!==a.tag;)a=a.return;xg=a;}
	function Gg(a){if(a!==xg)return !1;if(!I)return Fg(a),I=!0,!1;var b;(b=3!==a.tag)&&!(b=5!==a.tag)&&(b=a.type,b="head"!==b&&"body"!==b&&!Ef(a.type,a.memoizedProps));if(b&&(b=yg)){if(Dg(a))throw Hg(),Error(p$1(418));for(;b;)Ag(a,b),b=Lf(b.nextSibling);}Fg(a);if(13===a.tag){a=a.memoizedState;a=null!==a?a.dehydrated:null;if(!a)throw Error(p$1(317));a:{a=a.nextSibling;for(b=0;a;){if(8===a.nodeType){var c=a.data;if("/$"===c){if(0===b){yg=Lf(a.nextSibling);break a}b--;}else "$"!==c&&"$!"!==c&&"$?"!==c||b++;}a=a.nextSibling;}yg=
	null;}}else yg=xg?Lf(a.stateNode.nextSibling):null;return !0}function Hg(){for(var a=yg;a;)a=Lf(a.nextSibling);}function Ig(){yg=xg=null;I=!1;}function Jg(a){null===zg?zg=[a]:zg.push(a);}var Kg=ua.ReactCurrentBatchConfig;
	function Lg(a,b,c){a=c.ref;if(null!==a&&"function"!==typeof a&&"object"!==typeof a){if(c._owner){c=c._owner;if(c){if(1!==c.tag)throw Error(p$1(309));var d=c.stateNode;}if(!d)throw Error(p$1(147,a));var e=d,f=""+a;if(null!==b&&null!==b.ref&&"function"===typeof b.ref&&b.ref._stringRef===f)return b.ref;b=function(a){var b=e.refs;null===a?delete b[f]:b[f]=a;};b._stringRef=f;return b}if("string"!==typeof a)throw Error(p$1(284));if(!c._owner)throw Error(p$1(290,a));}return a}
	function Mg(a,b){a=Object.prototype.toString.call(b);throw Error(p$1(31,"[object Object]"===a?"object with keys {"+Object.keys(b).join(", ")+"}":a));}function Ng(a){var b=a._init;return b(a._payload)}
	function Og(a){function b(b,c){if(a){var d=b.deletions;null===d?(b.deletions=[c],b.flags|=16):d.push(c);}}function c(c,d){if(!a)return null;for(;null!==d;)b(c,d),d=d.sibling;return null}function d(a,b){for(a=new Map;null!==b;)null!==b.key?a.set(b.key,b):a.set(b.index,b),b=b.sibling;return a}function e(a,b){a=Pg(a,b);a.index=0;a.sibling=null;return a}function f(b,c,d){b.index=d;if(!a)return b.flags|=1048576,c;d=b.alternate;if(null!==d)return d=d.index,d<c?(b.flags|=2,c):d;b.flags|=2;return c}function g(b){a&&
	null===b.alternate&&(b.flags|=2);return b}function h(a,b,c,d){if(null===b||6!==b.tag)return b=Qg(c,a.mode,d),b.return=a,b;b=e(b,c);b.return=a;return b}function k(a,b,c,d){var f=c.type;if(f===ya)return m(a,b,c.props.children,d,c.key);if(null!==b&&(b.elementType===f||"object"===typeof f&&null!==f&&f.$$typeof===Ha&&Ng(f)===b.type))return d=e(b,c.props),d.ref=Lg(a,b,c),d.return=a,d;d=Rg(c.type,c.key,c.props,null,a.mode,d);d.ref=Lg(a,b,c);d.return=a;return d}function l(a,b,c,d){if(null===b||4!==b.tag||
	b.stateNode.containerInfo!==c.containerInfo||b.stateNode.implementation!==c.implementation)return b=Sg(c,a.mode,d),b.return=a,b;b=e(b,c.children||[]);b.return=a;return b}function m(a,b,c,d,f){if(null===b||7!==b.tag)return b=Tg(c,a.mode,d,f),b.return=a,b;b=e(b,c);b.return=a;return b}function q(a,b,c){if("string"===typeof b&&""!==b||"number"===typeof b)return b=Qg(""+b,a.mode,c),b.return=a,b;if("object"===typeof b&&null!==b){switch(b.$$typeof){case va:return c=Rg(b.type,b.key,b.props,null,a.mode,c),
	c.ref=Lg(a,null,b),c.return=a,c;case wa:return b=Sg(b,a.mode,c),b.return=a,b;case Ha:var d=b._init;return q(a,d(b._payload),c)}if(eb(b)||Ka(b))return b=Tg(b,a.mode,c,null),b.return=a,b;Mg(a,b);}return null}function r(a,b,c,d){var e=null!==b?b.key:null;if("string"===typeof c&&""!==c||"number"===typeof c)return null!==e?null:h(a,b,""+c,d);if("object"===typeof c&&null!==c){switch(c.$$typeof){case va:return c.key===e?k(a,b,c,d):null;case wa:return c.key===e?l(a,b,c,d):null;case Ha:return e=c._init,r(a,
	b,e(c._payload),d)}if(eb(c)||Ka(c))return null!==e?null:m(a,b,c,d,null);Mg(a,c);}return null}function y(a,b,c,d,e){if("string"===typeof d&&""!==d||"number"===typeof d)return a=a.get(c)||null,h(b,a,""+d,e);if("object"===typeof d&&null!==d){switch(d.$$typeof){case va:return a=a.get(null===d.key?c:d.key)||null,k(b,a,d,e);case wa:return a=a.get(null===d.key?c:d.key)||null,l(b,a,d,e);case Ha:var f=d._init;return y(a,b,c,f(d._payload),e)}if(eb(d)||Ka(d))return a=a.get(c)||null,m(b,a,d,e,null);Mg(b,d);}return null}
	function n(e,g,h,k){for(var l=null,m=null,u=g,w=g=0,x=null;null!==u&&w<h.length;w++){u.index>w?(x=u,u=null):x=u.sibling;var n=r(e,u,h[w],k);if(null===n){null===u&&(u=x);break}a&&u&&null===n.alternate&&b(e,u);g=f(n,g,w);null===m?l=n:m.sibling=n;m=n;u=x;}if(w===h.length)return c(e,u),I&&tg(e,w),l;if(null===u){for(;w<h.length;w++)u=q(e,h[w],k),null!==u&&(g=f(u,g,w),null===m?l=u:m.sibling=u,m=u);I&&tg(e,w);return l}for(u=d(e,u);w<h.length;w++)x=y(u,e,w,h[w],k),null!==x&&(a&&null!==x.alternate&&u.delete(null===
	x.key?w:x.key),g=f(x,g,w),null===m?l=x:m.sibling=x,m=x);a&&u.forEach(function(a){return b(e,a)});I&&tg(e,w);return l}function t(e,g,h,k){var l=Ka(h);if("function"!==typeof l)throw Error(p$1(150));h=l.call(h);if(null==h)throw Error(p$1(151));for(var u=l=null,m=g,w=g=0,x=null,n=h.next();null!==m&&!n.done;w++,n=h.next()){m.index>w?(x=m,m=null):x=m.sibling;var t=r(e,m,n.value,k);if(null===t){null===m&&(m=x);break}a&&m&&null===t.alternate&&b(e,m);g=f(t,g,w);null===u?l=t:u.sibling=t;u=t;m=x;}if(n.done)return c(e,
	m),I&&tg(e,w),l;if(null===m){for(;!n.done;w++,n=h.next())n=q(e,n.value,k),null!==n&&(g=f(n,g,w),null===u?l=n:u.sibling=n,u=n);I&&tg(e,w);return l}for(m=d(e,m);!n.done;w++,n=h.next())n=y(m,e,w,n.value,k),null!==n&&(a&&null!==n.alternate&&m.delete(null===n.key?w:n.key),g=f(n,g,w),null===u?l=n:u.sibling=n,u=n);a&&m.forEach(function(a){return b(e,a)});I&&tg(e,w);return l}function J(a,d,f,h){"object"===typeof f&&null!==f&&f.type===ya&&null===f.key&&(f=f.props.children);if("object"===typeof f&&null!==f){switch(f.$$typeof){case va:a:{for(var k=
	f.key,l=d;null!==l;){if(l.key===k){k=f.type;if(k===ya){if(7===l.tag){c(a,l.sibling);d=e(l,f.props.children);d.return=a;a=d;break a}}else if(l.elementType===k||"object"===typeof k&&null!==k&&k.$$typeof===Ha&&Ng(k)===l.type){c(a,l.sibling);d=e(l,f.props);d.ref=Lg(a,l,f);d.return=a;a=d;break a}c(a,l);break}else b(a,l);l=l.sibling;}f.type===ya?(d=Tg(f.props.children,a.mode,h,f.key),d.return=a,a=d):(h=Rg(f.type,f.key,f.props,null,a.mode,h),h.ref=Lg(a,d,f),h.return=a,a=h);}return g(a);case wa:a:{for(l=f.key;null!==
	d;){if(d.key===l)if(4===d.tag&&d.stateNode.containerInfo===f.containerInfo&&d.stateNode.implementation===f.implementation){c(a,d.sibling);d=e(d,f.children||[]);d.return=a;a=d;break a}else {c(a,d);break}else b(a,d);d=d.sibling;}d=Sg(f,a.mode,h);d.return=a;a=d;}return g(a);case Ha:return l=f._init,J(a,d,l(f._payload),h)}if(eb(f))return n(a,d,f,h);if(Ka(f))return t(a,d,f,h);Mg(a,f);}return "string"===typeof f&&""!==f||"number"===typeof f?(f=""+f,null!==d&&6===d.tag?(c(a,d.sibling),d=e(d,f),d.return=a,a=d):
	(c(a,d),d=Qg(f,a.mode,h),d.return=a,a=d),g(a)):c(a,d)}return J}var Ug=Og(!0),Vg=Og(!1),Wg=Uf(null),Xg=null,Yg=null,Zg=null;function $g(){Zg=Yg=Xg=null;}function ah(a){var b=Wg.current;E(Wg);a._currentValue=b;}function bh(a,b,c){for(;null!==a;){var d=a.alternate;(a.childLanes&b)!==b?(a.childLanes|=b,null!==d&&(d.childLanes|=b)):null!==d&&(d.childLanes&b)!==b&&(d.childLanes|=b);if(a===c)break;a=a.return;}}
	function ch(a,b){Xg=a;Zg=Yg=null;a=a.dependencies;null!==a&&null!==a.firstContext&&(0!==(a.lanes&b)&&(dh=!0),a.firstContext=null);}function eh(a){var b=a._currentValue;if(Zg!==a)if(a={context:a,memoizedValue:b,next:null},null===Yg){if(null===Xg)throw Error(p$1(308));Yg=a;Xg.dependencies={lanes:0,firstContext:a};}else Yg=Yg.next=a;return b}var fh=null;function gh(a){null===fh?fh=[a]:fh.push(a);}
	function hh(a,b,c,d){var e=b.interleaved;null===e?(c.next=c,gh(b)):(c.next=e.next,e.next=c);b.interleaved=c;return ih(a,d)}function ih(a,b){a.lanes|=b;var c=a.alternate;null!==c&&(c.lanes|=b);c=a;for(a=a.return;null!==a;)a.childLanes|=b,c=a.alternate,null!==c&&(c.childLanes|=b),c=a,a=a.return;return 3===c.tag?c.stateNode:null}var jh=!1;function kh(a){a.updateQueue={baseState:a.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null};}
	function lh(a,b){a=a.updateQueue;b.updateQueue===a&&(b.updateQueue={baseState:a.baseState,firstBaseUpdate:a.firstBaseUpdate,lastBaseUpdate:a.lastBaseUpdate,shared:a.shared,effects:a.effects});}function mh(a,b){return {eventTime:a,lane:b,tag:0,payload:null,callback:null,next:null}}
	function nh(a,b,c){var d=a.updateQueue;if(null===d)return null;d=d.shared;if(0!==(K&2)){var e=d.pending;null===e?b.next=b:(b.next=e.next,e.next=b);d.pending=b;return ih(a,c)}e=d.interleaved;null===e?(b.next=b,gh(d)):(b.next=e.next,e.next=b);d.interleaved=b;return ih(a,c)}function oh(a,b,c){b=b.updateQueue;if(null!==b&&(b=b.shared,0!==(c&4194240))){var d=b.lanes;d&=a.pendingLanes;c|=d;b.lanes=c;Cc(a,c);}}
	function ph(a,b){var c=a.updateQueue,d=a.alternate;if(null!==d&&(d=d.updateQueue,c===d)){var e=null,f=null;c=c.firstBaseUpdate;if(null!==c){do{var g={eventTime:c.eventTime,lane:c.lane,tag:c.tag,payload:c.payload,callback:c.callback,next:null};null===f?e=f=g:f=f.next=g;c=c.next;}while(null!==c);null===f?e=f=b:f=f.next=b;}else e=f=b;c={baseState:d.baseState,firstBaseUpdate:e,lastBaseUpdate:f,shared:d.shared,effects:d.effects};a.updateQueue=c;return}a=c.lastBaseUpdate;null===a?c.firstBaseUpdate=b:a.next=
	b;c.lastBaseUpdate=b;}
	function qh(a,b,c,d){var e=a.updateQueue;jh=!1;var f=e.firstBaseUpdate,g=e.lastBaseUpdate,h=e.shared.pending;if(null!==h){e.shared.pending=null;var k=h,l=k.next;k.next=null;null===g?f=l:g.next=l;g=k;var m=a.alternate;null!==m&&(m=m.updateQueue,h=m.lastBaseUpdate,h!==g&&(null===h?m.firstBaseUpdate=l:h.next=l,m.lastBaseUpdate=k));}if(null!==f){var q=e.baseState;g=0;m=l=k=null;h=f;do{var r=h.lane,y=h.eventTime;if((d&r)===r){null!==m&&(m=m.next={eventTime:y,lane:0,tag:h.tag,payload:h.payload,callback:h.callback,
	next:null});a:{var n=a,t=h;r=b;y=c;switch(t.tag){case 1:n=t.payload;if("function"===typeof n){q=n.call(y,q,r);break a}q=n;break a;case 3:n.flags=n.flags&-65537|128;case 0:n=t.payload;r="function"===typeof n?n.call(y,q,r):n;if(null===r||void 0===r)break a;q=A({},q,r);break a;case 2:jh=!0;}}null!==h.callback&&0!==h.lane&&(a.flags|=64,r=e.effects,null===r?e.effects=[h]:r.push(h));}else y={eventTime:y,lane:r,tag:h.tag,payload:h.payload,callback:h.callback,next:null},null===m?(l=m=y,k=q):m=m.next=y,g|=r;
	h=h.next;if(null===h)if(h=e.shared.pending,null===h)break;else r=h,h=r.next,r.next=null,e.lastBaseUpdate=r,e.shared.pending=null;}while(1);null===m&&(k=q);e.baseState=k;e.firstBaseUpdate=l;e.lastBaseUpdate=m;b=e.shared.interleaved;if(null!==b){e=b;do g|=e.lane,e=e.next;while(e!==b)}else null===f&&(e.shared.lanes=0);rh|=g;a.lanes=g;a.memoizedState=q;}}
	function sh(a,b,c){a=b.effects;b.effects=null;if(null!==a)for(b=0;b<a.length;b++){var d=a[b],e=d.callback;if(null!==e){d.callback=null;d=c;if("function"!==typeof e)throw Error(p$1(191,e));e.call(d);}}}var th={},uh=Uf(th),vh=Uf(th),wh=Uf(th);function xh(a){if(a===th)throw Error(p$1(174));return a}
	function yh(a,b){G(wh,b);G(vh,a);G(uh,th);a=b.nodeType;switch(a){case 9:case 11:b=(b=b.documentElement)?b.namespaceURI:lb(null,"");break;default:a=8===a?b.parentNode:b,b=a.namespaceURI||null,a=a.tagName,b=lb(b,a);}E(uh);G(uh,b);}function zh(){E(uh);E(vh);E(wh);}function Ah(a){xh(wh.current);var b=xh(uh.current);var c=lb(b,a.type);b!==c&&(G(vh,a),G(uh,c));}function Bh(a){vh.current===a&&(E(uh),E(vh));}var L=Uf(0);
	function Ch(a){for(var b=a;null!==b;){if(13===b.tag){var c=b.memoizedState;if(null!==c&&(c=c.dehydrated,null===c||"$?"===c.data||"$!"===c.data))return b}else if(19===b.tag&&void 0!==b.memoizedProps.revealOrder){if(0!==(b.flags&128))return b}else if(null!==b.child){b.child.return=b;b=b.child;continue}if(b===a)break;for(;null===b.sibling;){if(null===b.return||b.return===a)return null;b=b.return;}b.sibling.return=b.return;b=b.sibling;}return null}var Dh=[];
	function Eh(){for(var a=0;a<Dh.length;a++)Dh[a]._workInProgressVersionPrimary=null;Dh.length=0;}var Fh=ua.ReactCurrentDispatcher,Gh=ua.ReactCurrentBatchConfig,Hh=0,M=null,N=null,O=null,Ih=!1,Jh=!1,Kh=0,Lh=0;function P$1(){throw Error(p$1(321));}function Mh(a,b){if(null===b)return !1;for(var c=0;c<b.length&&c<a.length;c++)if(!He(a[c],b[c]))return !1;return !0}
	function Nh(a,b,c,d,e,f){Hh=f;M=b;b.memoizedState=null;b.updateQueue=null;b.lanes=0;Fh.current=null===a||null===a.memoizedState?Oh:Ph;a=c(d,e);if(Jh){f=0;do{Jh=!1;Kh=0;if(25<=f)throw Error(p$1(301));f+=1;O=N=null;b.updateQueue=null;Fh.current=Qh;a=c(d,e);}while(Jh)}Fh.current=Rh;b=null!==N&&null!==N.next;Hh=0;O=N=M=null;Ih=!1;if(b)throw Error(p$1(300));return a}function Sh(){var a=0!==Kh;Kh=0;return a}
	function Th(){var a={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};null===O?M.memoizedState=O=a:O=O.next=a;return O}function Uh(){if(null===N){var a=M.alternate;a=null!==a?a.memoizedState:null;}else a=N.next;var b=null===O?M.memoizedState:O.next;if(null!==b)O=b,N=a;else {if(null===a)throw Error(p$1(310));N=a;a={memoizedState:N.memoizedState,baseState:N.baseState,baseQueue:N.baseQueue,queue:N.queue,next:null};null===O?M.memoizedState=O=a:O=O.next=a;}return O}
	function Vh(a,b){return "function"===typeof b?b(a):b}
	function Wh(a){var b=Uh(),c=b.queue;if(null===c)throw Error(p$1(311));c.lastRenderedReducer=a;var d=N,e=d.baseQueue,f=c.pending;if(null!==f){if(null!==e){var g=e.next;e.next=f.next;f.next=g;}d.baseQueue=e=f;c.pending=null;}if(null!==e){f=e.next;d=d.baseState;var h=g=null,k=null,l=f;do{var m=l.lane;if((Hh&m)===m)null!==k&&(k=k.next={lane:0,action:l.action,hasEagerState:l.hasEagerState,eagerState:l.eagerState,next:null}),d=l.hasEagerState?l.eagerState:a(d,l.action);else {var q={lane:m,action:l.action,hasEagerState:l.hasEagerState,
	eagerState:l.eagerState,next:null};null===k?(h=k=q,g=d):k=k.next=q;M.lanes|=m;rh|=m;}l=l.next;}while(null!==l&&l!==f);null===k?g=d:k.next=h;He(d,b.memoizedState)||(dh=!0);b.memoizedState=d;b.baseState=g;b.baseQueue=k;c.lastRenderedState=d;}a=c.interleaved;if(null!==a){e=a;do f=e.lane,M.lanes|=f,rh|=f,e=e.next;while(e!==a)}else null===e&&(c.lanes=0);return [b.memoizedState,c.dispatch]}
	function Xh(a){var b=Uh(),c=b.queue;if(null===c)throw Error(p$1(311));c.lastRenderedReducer=a;var d=c.dispatch,e=c.pending,f=b.memoizedState;if(null!==e){c.pending=null;var g=e=e.next;do f=a(f,g.action),g=g.next;while(g!==e);He(f,b.memoizedState)||(dh=!0);b.memoizedState=f;null===b.baseQueue&&(b.baseState=f);c.lastRenderedState=f;}return [f,d]}function Yh(){}
	function Zh(a,b){var c=M,d=Uh(),e=b(),f=!He(d.memoizedState,e);f&&(d.memoizedState=e,dh=!0);d=d.queue;$h(ai.bind(null,c,d,a),[a]);if(d.getSnapshot!==b||f||null!==O&&O.memoizedState.tag&1){c.flags|=2048;bi(9,ci.bind(null,c,d,e,b),void 0,null);if(null===Q)throw Error(p$1(349));0!==(Hh&30)||di(c,b,e);}return e}function di(a,b,c){a.flags|=16384;a={getSnapshot:b,value:c};b=M.updateQueue;null===b?(b={lastEffect:null,stores:null},M.updateQueue=b,b.stores=[a]):(c=b.stores,null===c?b.stores=[a]:c.push(a));}
	function ci(a,b,c,d){b.value=c;b.getSnapshot=d;ei(b)&&fi(a);}function ai(a,b,c){return c(function(){ei(b)&&fi(a);})}function ei(a){var b=a.getSnapshot;a=a.value;try{var c=b();return !He(a,c)}catch(d){return !0}}function fi(a){var b=ih(a,1);null!==b&&gi(b,a,1,-1);}
	function hi(a){var b=Th();"function"===typeof a&&(a=a());b.memoizedState=b.baseState=a;a={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:Vh,lastRenderedState:a};b.queue=a;a=a.dispatch=ii.bind(null,M,a);return [b.memoizedState,a]}
	function bi(a,b,c,d){a={tag:a,create:b,destroy:c,deps:d,next:null};b=M.updateQueue;null===b?(b={lastEffect:null,stores:null},M.updateQueue=b,b.lastEffect=a.next=a):(c=b.lastEffect,null===c?b.lastEffect=a.next=a:(d=c.next,c.next=a,a.next=d,b.lastEffect=a));return a}function ji(){return Uh().memoizedState}function ki(a,b,c,d){var e=Th();M.flags|=a;e.memoizedState=bi(1|b,c,void 0,void 0===d?null:d);}
	function li(a,b,c,d){var e=Uh();d=void 0===d?null:d;var f=void 0;if(null!==N){var g=N.memoizedState;f=g.destroy;if(null!==d&&Mh(d,g.deps)){e.memoizedState=bi(b,c,f,d);return}}M.flags|=a;e.memoizedState=bi(1|b,c,f,d);}function mi(a,b){return ki(8390656,8,a,b)}function $h(a,b){return li(2048,8,a,b)}function ni(a,b){return li(4,2,a,b)}function oi(a,b){return li(4,4,a,b)}
	function pi(a,b){if("function"===typeof b)return a=a(),b(a),function(){b(null);};if(null!==b&&void 0!==b)return a=a(),b.current=a,function(){b.current=null;}}function qi(a,b,c){c=null!==c&&void 0!==c?c.concat([a]):null;return li(4,4,pi.bind(null,b,a),c)}function ri(){}function si(a,b){var c=Uh();b=void 0===b?null:b;var d=c.memoizedState;if(null!==d&&null!==b&&Mh(b,d[1]))return d[0];c.memoizedState=[a,b];return a}
	function ti(a,b){var c=Uh();b=void 0===b?null:b;var d=c.memoizedState;if(null!==d&&null!==b&&Mh(b,d[1]))return d[0];a=a();c.memoizedState=[a,b];return a}function ui(a,b,c){if(0===(Hh&21))return a.baseState&&(a.baseState=!1,dh=!0),a.memoizedState=c;He(c,b)||(c=yc(),M.lanes|=c,rh|=c,a.baseState=!0);return b}function vi(a,b){var c=C;C=0!==c&&4>c?c:4;a(!0);var d=Gh.transition;Gh.transition={};try{a(!1),b();}finally{C=c,Gh.transition=d;}}function wi(){return Uh().memoizedState}
	function xi(a,b,c){var d=yi(a);c={lane:d,action:c,hasEagerState:!1,eagerState:null,next:null};if(zi(a))Ai(b,c);else if(c=hh(a,b,c,d),null!==c){var e=R();gi(c,a,d,e);Bi(c,b,d);}}
	function ii(a,b,c){var d=yi(a),e={lane:d,action:c,hasEagerState:!1,eagerState:null,next:null};if(zi(a))Ai(b,e);else {var f=a.alternate;if(0===a.lanes&&(null===f||0===f.lanes)&&(f=b.lastRenderedReducer,null!==f))try{var g=b.lastRenderedState,h=f(g,c);e.hasEagerState=!0;e.eagerState=h;if(He(h,g)){var k=b.interleaved;null===k?(e.next=e,gh(b)):(e.next=k.next,k.next=e);b.interleaved=e;return}}catch(l){}finally{}c=hh(a,b,e,d);null!==c&&(e=R(),gi(c,a,d,e),Bi(c,b,d));}}
	function zi(a){var b=a.alternate;return a===M||null!==b&&b===M}function Ai(a,b){Jh=Ih=!0;var c=a.pending;null===c?b.next=b:(b.next=c.next,c.next=b);a.pending=b;}function Bi(a,b,c){if(0!==(c&4194240)){var d=b.lanes;d&=a.pendingLanes;c|=d;b.lanes=c;Cc(a,c);}}
	var Rh={readContext:eh,useCallback:P$1,useContext:P$1,useEffect:P$1,useImperativeHandle:P$1,useInsertionEffect:P$1,useLayoutEffect:P$1,useMemo:P$1,useReducer:P$1,useRef:P$1,useState:P$1,useDebugValue:P$1,useDeferredValue:P$1,useTransition:P$1,useMutableSource:P$1,useSyncExternalStore:P$1,useId:P$1,unstable_isNewReconciler:!1},Oh={readContext:eh,useCallback:function(a,b){Th().memoizedState=[a,void 0===b?null:b];return a},useContext:eh,useEffect:mi,useImperativeHandle:function(a,b,c){c=null!==c&&void 0!==c?c.concat([a]):null;return ki(4194308,
	4,pi.bind(null,b,a),c)},useLayoutEffect:function(a,b){return ki(4194308,4,a,b)},useInsertionEffect:function(a,b){return ki(4,2,a,b)},useMemo:function(a,b){var c=Th();b=void 0===b?null:b;a=a();c.memoizedState=[a,b];return a},useReducer:function(a,b,c){var d=Th();b=void 0!==c?c(b):b;d.memoizedState=d.baseState=b;a={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:a,lastRenderedState:b};d.queue=a;a=a.dispatch=xi.bind(null,M,a);return [d.memoizedState,a]},useRef:function(a){var b=
	Th();a={current:a};return b.memoizedState=a},useState:hi,useDebugValue:ri,useDeferredValue:function(a){return Th().memoizedState=a},useTransition:function(){var a=hi(!1),b=a[0];a=vi.bind(null,a[1]);Th().memoizedState=a;return [b,a]},useMutableSource:function(){},useSyncExternalStore:function(a,b,c){var d=M,e=Th();if(I){if(void 0===c)throw Error(p$1(407));c=c();}else {c=b();if(null===Q)throw Error(p$1(349));0!==(Hh&30)||di(d,b,c);}e.memoizedState=c;var f={value:c,getSnapshot:b};e.queue=f;mi(ai.bind(null,d,
	f,a),[a]);d.flags|=2048;bi(9,ci.bind(null,d,f,c,b),void 0,null);return c},useId:function(){var a=Th(),b=Q.identifierPrefix;if(I){var c=sg;var d=rg;c=(d&~(1<<32-oc(d)-1)).toString(32)+c;b=":"+b+"R"+c;c=Kh++;0<c&&(b+="H"+c.toString(32));b+=":";}else c=Lh++,b=":"+b+"r"+c.toString(32)+":";return a.memoizedState=b},unstable_isNewReconciler:!1},Ph={readContext:eh,useCallback:si,useContext:eh,useEffect:$h,useImperativeHandle:qi,useInsertionEffect:ni,useLayoutEffect:oi,useMemo:ti,useReducer:Wh,useRef:ji,useState:function(){return Wh(Vh)},
	useDebugValue:ri,useDeferredValue:function(a){var b=Uh();return ui(b,N.memoizedState,a)},useTransition:function(){var a=Wh(Vh)[0],b=Uh().memoizedState;return [a,b]},useMutableSource:Yh,useSyncExternalStore:Zh,useId:wi,unstable_isNewReconciler:!1},Qh={readContext:eh,useCallback:si,useContext:eh,useEffect:$h,useImperativeHandle:qi,useInsertionEffect:ni,useLayoutEffect:oi,useMemo:ti,useReducer:Xh,useRef:ji,useState:function(){return Xh(Vh)},useDebugValue:ri,useDeferredValue:function(a){var b=Uh();return null===
	N?b.memoizedState=a:ui(b,N.memoizedState,a)},useTransition:function(){var a=Xh(Vh)[0],b=Uh().memoizedState;return [a,b]},useMutableSource:Yh,useSyncExternalStore:Zh,useId:wi,unstable_isNewReconciler:!1};function Ci(a,b){if(a&&a.defaultProps){b=A({},b);a=a.defaultProps;for(var c in a)void 0===b[c]&&(b[c]=a[c]);return b}return b}function Di(a,b,c,d){b=a.memoizedState;c=c(d,b);c=null===c||void 0===c?b:A({},b,c);a.memoizedState=c;0===a.lanes&&(a.updateQueue.baseState=c);}
	var Ei={isMounted:function(a){return (a=a._reactInternals)?Vb(a)===a:!1},enqueueSetState:function(a,b,c){a=a._reactInternals;var d=R(),e=yi(a),f=mh(d,e);f.payload=b;void 0!==c&&null!==c&&(f.callback=c);b=nh(a,f,e);null!==b&&(gi(b,a,e,d),oh(b,a,e));},enqueueReplaceState:function(a,b,c){a=a._reactInternals;var d=R(),e=yi(a),f=mh(d,e);f.tag=1;f.payload=b;void 0!==c&&null!==c&&(f.callback=c);b=nh(a,f,e);null!==b&&(gi(b,a,e,d),oh(b,a,e));},enqueueForceUpdate:function(a,b){a=a._reactInternals;var c=R(),d=
	yi(a),e=mh(c,d);e.tag=2;void 0!==b&&null!==b&&(e.callback=b);b=nh(a,e,d);null!==b&&(gi(b,a,d,c),oh(b,a,d));}};function Fi(a,b,c,d,e,f,g){a=a.stateNode;return "function"===typeof a.shouldComponentUpdate?a.shouldComponentUpdate(d,f,g):b.prototype&&b.prototype.isPureReactComponent?!Ie(c,d)||!Ie(e,f):!0}
	function Gi(a,b,c){var d=!1,e=Vf;var f=b.contextType;"object"===typeof f&&null!==f?f=eh(f):(e=Zf(b)?Xf:H.current,d=b.contextTypes,f=(d=null!==d&&void 0!==d)?Yf(a,e):Vf);b=new b(c,f);a.memoizedState=null!==b.state&&void 0!==b.state?b.state:null;b.updater=Ei;a.stateNode=b;b._reactInternals=a;d&&(a=a.stateNode,a.__reactInternalMemoizedUnmaskedChildContext=e,a.__reactInternalMemoizedMaskedChildContext=f);return b}
	function Hi(a,b,c,d){a=b.state;"function"===typeof b.componentWillReceiveProps&&b.componentWillReceiveProps(c,d);"function"===typeof b.UNSAFE_componentWillReceiveProps&&b.UNSAFE_componentWillReceiveProps(c,d);b.state!==a&&Ei.enqueueReplaceState(b,b.state,null);}
	function Ii(a,b,c,d){var e=a.stateNode;e.props=c;e.state=a.memoizedState;e.refs={};kh(a);var f=b.contextType;"object"===typeof f&&null!==f?e.context=eh(f):(f=Zf(b)?Xf:H.current,e.context=Yf(a,f));e.state=a.memoizedState;f=b.getDerivedStateFromProps;"function"===typeof f&&(Di(a,b,f,c),e.state=a.memoizedState);"function"===typeof b.getDerivedStateFromProps||"function"===typeof e.getSnapshotBeforeUpdate||"function"!==typeof e.UNSAFE_componentWillMount&&"function"!==typeof e.componentWillMount||(b=e.state,
	"function"===typeof e.componentWillMount&&e.componentWillMount(),"function"===typeof e.UNSAFE_componentWillMount&&e.UNSAFE_componentWillMount(),b!==e.state&&Ei.enqueueReplaceState(e,e.state,null),qh(a,c,e,d),e.state=a.memoizedState);"function"===typeof e.componentDidMount&&(a.flags|=4194308);}function Ji(a,b){try{var c="",d=b;do c+=Pa(d),d=d.return;while(d);var e=c;}catch(f){e="\nError generating stack: "+f.message+"\n"+f.stack;}return {value:a,source:b,stack:e,digest:null}}
	function Ki(a,b,c){return {value:a,source:null,stack:null!=c?c:null,digest:null!=b?b:null}}function Li(a,b){try{console.error(b.value);}catch(c){setTimeout(function(){throw c;});}}var Mi="function"===typeof WeakMap?WeakMap:Map;function Ni(a,b,c){c=mh(-1,c);c.tag=3;c.payload={element:null};var d=b.value;c.callback=function(){Oi||(Oi=!0,Pi=d);Li(a,b);};return c}
	function Qi(a,b,c){c=mh(-1,c);c.tag=3;var d=a.type.getDerivedStateFromError;if("function"===typeof d){var e=b.value;c.payload=function(){return d(e)};c.callback=function(){Li(a,b);};}var f=a.stateNode;null!==f&&"function"===typeof f.componentDidCatch&&(c.callback=function(){Li(a,b);"function"!==typeof d&&(null===Ri?Ri=new Set([this]):Ri.add(this));var c=b.stack;this.componentDidCatch(b.value,{componentStack:null!==c?c:""});});return c}
	function Si(a,b,c){var d=a.pingCache;if(null===d){d=a.pingCache=new Mi;var e=new Set;d.set(b,e);}else e=d.get(b),void 0===e&&(e=new Set,d.set(b,e));e.has(c)||(e.add(c),a=Ti.bind(null,a,b,c),b.then(a,a));}function Ui(a){do{var b;if(b=13===a.tag)b=a.memoizedState,b=null!==b?null!==b.dehydrated?!0:!1:!0;if(b)return a;a=a.return;}while(null!==a);return null}
	function Vi(a,b,c,d,e){if(0===(a.mode&1))return a===b?a.flags|=65536:(a.flags|=128,c.flags|=131072,c.flags&=-52805,1===c.tag&&(null===c.alternate?c.tag=17:(b=mh(-1,1),b.tag=2,nh(c,b,1))),c.lanes|=1),a;a.flags|=65536;a.lanes=e;return a}var Wi=ua.ReactCurrentOwner,dh=!1;function Xi(a,b,c,d){b.child=null===a?Vg(b,null,c,d):Ug(b,a.child,c,d);}
	function Yi(a,b,c,d,e){c=c.render;var f=b.ref;ch(b,e);d=Nh(a,b,c,d,f,e);c=Sh();if(null!==a&&!dh)return b.updateQueue=a.updateQueue,b.flags&=-2053,a.lanes&=~e,Zi(a,b,e);I&&c&&vg(b);b.flags|=1;Xi(a,b,d,e);return b.child}
	function $i(a,b,c,d,e){if(null===a){var f=c.type;if("function"===typeof f&&!aj(f)&&void 0===f.defaultProps&&null===c.compare&&void 0===c.defaultProps)return b.tag=15,b.type=f,bj(a,b,f,d,e);a=Rg(c.type,null,d,b,b.mode,e);a.ref=b.ref;a.return=b;return b.child=a}f=a.child;if(0===(a.lanes&e)){var g=f.memoizedProps;c=c.compare;c=null!==c?c:Ie;if(c(g,d)&&a.ref===b.ref)return Zi(a,b,e)}b.flags|=1;a=Pg(f,d);a.ref=b.ref;a.return=b;return b.child=a}
	function bj(a,b,c,d,e){if(null!==a){var f=a.memoizedProps;if(Ie(f,d)&&a.ref===b.ref)if(dh=!1,b.pendingProps=d=f,0!==(a.lanes&e))0!==(a.flags&131072)&&(dh=!0);else return b.lanes=a.lanes,Zi(a,b,e)}return cj(a,b,c,d,e)}
	function dj(a,b,c){var d=b.pendingProps,e=d.children,f=null!==a?a.memoizedState:null;if("hidden"===d.mode)if(0===(b.mode&1))b.memoizedState={baseLanes:0,cachePool:null,transitions:null},G(ej,fj),fj|=c;else {if(0===(c&1073741824))return a=null!==f?f.baseLanes|c:c,b.lanes=b.childLanes=1073741824,b.memoizedState={baseLanes:a,cachePool:null,transitions:null},b.updateQueue=null,G(ej,fj),fj|=a,null;b.memoizedState={baseLanes:0,cachePool:null,transitions:null};d=null!==f?f.baseLanes:c;G(ej,fj);fj|=d;}else null!==
	f?(d=f.baseLanes|c,b.memoizedState=null):d=c,G(ej,fj),fj|=d;Xi(a,b,e,c);return b.child}function gj(a,b){var c=b.ref;if(null===a&&null!==c||null!==a&&a.ref!==c)b.flags|=512,b.flags|=2097152;}function cj(a,b,c,d,e){var f=Zf(c)?Xf:H.current;f=Yf(b,f);ch(b,e);c=Nh(a,b,c,d,f,e);d=Sh();if(null!==a&&!dh)return b.updateQueue=a.updateQueue,b.flags&=-2053,a.lanes&=~e,Zi(a,b,e);I&&d&&vg(b);b.flags|=1;Xi(a,b,c,e);return b.child}
	function hj(a,b,c,d,e){if(Zf(c)){var f=!0;cg(b);}else f=!1;ch(b,e);if(null===b.stateNode)ij(a,b),Gi(b,c,d),Ii(b,c,d,e),d=!0;else if(null===a){var g=b.stateNode,h=b.memoizedProps;g.props=h;var k=g.context,l=c.contextType;"object"===typeof l&&null!==l?l=eh(l):(l=Zf(c)?Xf:H.current,l=Yf(b,l));var m=c.getDerivedStateFromProps,q="function"===typeof m||"function"===typeof g.getSnapshotBeforeUpdate;q||"function"!==typeof g.UNSAFE_componentWillReceiveProps&&"function"!==typeof g.componentWillReceiveProps||
	(h!==d||k!==l)&&Hi(b,g,d,l);jh=!1;var r=b.memoizedState;g.state=r;qh(b,d,g,e);k=b.memoizedState;h!==d||r!==k||Wf.current||jh?("function"===typeof m&&(Di(b,c,m,d),k=b.memoizedState),(h=jh||Fi(b,c,h,d,r,k,l))?(q||"function"!==typeof g.UNSAFE_componentWillMount&&"function"!==typeof g.componentWillMount||("function"===typeof g.componentWillMount&&g.componentWillMount(),"function"===typeof g.UNSAFE_componentWillMount&&g.UNSAFE_componentWillMount()),"function"===typeof g.componentDidMount&&(b.flags|=4194308)):
	("function"===typeof g.componentDidMount&&(b.flags|=4194308),b.memoizedProps=d,b.memoizedState=k),g.props=d,g.state=k,g.context=l,d=h):("function"===typeof g.componentDidMount&&(b.flags|=4194308),d=!1);}else {g=b.stateNode;lh(a,b);h=b.memoizedProps;l=b.type===b.elementType?h:Ci(b.type,h);g.props=l;q=b.pendingProps;r=g.context;k=c.contextType;"object"===typeof k&&null!==k?k=eh(k):(k=Zf(c)?Xf:H.current,k=Yf(b,k));var y=c.getDerivedStateFromProps;(m="function"===typeof y||"function"===typeof g.getSnapshotBeforeUpdate)||
	"function"!==typeof g.UNSAFE_componentWillReceiveProps&&"function"!==typeof g.componentWillReceiveProps||(h!==q||r!==k)&&Hi(b,g,d,k);jh=!1;r=b.memoizedState;g.state=r;qh(b,d,g,e);var n=b.memoizedState;h!==q||r!==n||Wf.current||jh?("function"===typeof y&&(Di(b,c,y,d),n=b.memoizedState),(l=jh||Fi(b,c,l,d,r,n,k)||!1)?(m||"function"!==typeof g.UNSAFE_componentWillUpdate&&"function"!==typeof g.componentWillUpdate||("function"===typeof g.componentWillUpdate&&g.componentWillUpdate(d,n,k),"function"===typeof g.UNSAFE_componentWillUpdate&&
	g.UNSAFE_componentWillUpdate(d,n,k)),"function"===typeof g.componentDidUpdate&&(b.flags|=4),"function"===typeof g.getSnapshotBeforeUpdate&&(b.flags|=1024)):("function"!==typeof g.componentDidUpdate||h===a.memoizedProps&&r===a.memoizedState||(b.flags|=4),"function"!==typeof g.getSnapshotBeforeUpdate||h===a.memoizedProps&&r===a.memoizedState||(b.flags|=1024),b.memoizedProps=d,b.memoizedState=n),g.props=d,g.state=n,g.context=k,d=l):("function"!==typeof g.componentDidUpdate||h===a.memoizedProps&&r===
	a.memoizedState||(b.flags|=4),"function"!==typeof g.getSnapshotBeforeUpdate||h===a.memoizedProps&&r===a.memoizedState||(b.flags|=1024),d=!1);}return jj(a,b,c,d,f,e)}
	function jj(a,b,c,d,e,f){gj(a,b);var g=0!==(b.flags&128);if(!d&&!g)return e&&dg(b,c,!1),Zi(a,b,f);d=b.stateNode;Wi.current=b;var h=g&&"function"!==typeof c.getDerivedStateFromError?null:d.render();b.flags|=1;null!==a&&g?(b.child=Ug(b,a.child,null,f),b.child=Ug(b,null,h,f)):Xi(a,b,h,f);b.memoizedState=d.state;e&&dg(b,c,!0);return b.child}function kj(a){var b=a.stateNode;b.pendingContext?ag(a,b.pendingContext,b.pendingContext!==b.context):b.context&&ag(a,b.context,!1);yh(a,b.containerInfo);}
	function lj(a,b,c,d,e){Ig();Jg(e);b.flags|=256;Xi(a,b,c,d);return b.child}var mj={dehydrated:null,treeContext:null,retryLane:0};function nj(a){return {baseLanes:a,cachePool:null,transitions:null}}
	function oj(a,b,c){var d=b.pendingProps,e=L.current,f=!1,g=0!==(b.flags&128),h;(h=g)||(h=null!==a&&null===a.memoizedState?!1:0!==(e&2));if(h)f=!0,b.flags&=-129;else if(null===a||null!==a.memoizedState)e|=1;G(L,e&1);if(null===a){Eg(b);a=b.memoizedState;if(null!==a&&(a=a.dehydrated,null!==a))return 0===(b.mode&1)?b.lanes=1:"$!"===a.data?b.lanes=8:b.lanes=1073741824,null;g=d.children;a=d.fallback;return f?(d=b.mode,f=b.child,g={mode:"hidden",children:g},0===(d&1)&&null!==f?(f.childLanes=0,f.pendingProps=
	g):f=pj(g,d,0,null),a=Tg(a,d,c,null),f.return=b,a.return=b,f.sibling=a,b.child=f,b.child.memoizedState=nj(c),b.memoizedState=mj,a):qj(b,g)}e=a.memoizedState;if(null!==e&&(h=e.dehydrated,null!==h))return rj(a,b,g,d,h,e,c);if(f){f=d.fallback;g=b.mode;e=a.child;h=e.sibling;var k={mode:"hidden",children:d.children};0===(g&1)&&b.child!==e?(d=b.child,d.childLanes=0,d.pendingProps=k,b.deletions=null):(d=Pg(e,k),d.subtreeFlags=e.subtreeFlags&14680064);null!==h?f=Pg(h,f):(f=Tg(f,g,c,null),f.flags|=2);f.return=
	b;d.return=b;d.sibling=f;b.child=d;d=f;f=b.child;g=a.child.memoizedState;g=null===g?nj(c):{baseLanes:g.baseLanes|c,cachePool:null,transitions:g.transitions};f.memoizedState=g;f.childLanes=a.childLanes&~c;b.memoizedState=mj;return d}f=a.child;a=f.sibling;d=Pg(f,{mode:"visible",children:d.children});0===(b.mode&1)&&(d.lanes=c);d.return=b;d.sibling=null;null!==a&&(c=b.deletions,null===c?(b.deletions=[a],b.flags|=16):c.push(a));b.child=d;b.memoizedState=null;return d}
	function qj(a,b){b=pj({mode:"visible",children:b},a.mode,0,null);b.return=a;return a.child=b}function sj(a,b,c,d){null!==d&&Jg(d);Ug(b,a.child,null,c);a=qj(b,b.pendingProps.children);a.flags|=2;b.memoizedState=null;return a}
	function rj(a,b,c,d,e,f,g){if(c){if(b.flags&256)return b.flags&=-257,d=Ki(Error(p$1(422))),sj(a,b,g,d);if(null!==b.memoizedState)return b.child=a.child,b.flags|=128,null;f=d.fallback;e=b.mode;d=pj({mode:"visible",children:d.children},e,0,null);f=Tg(f,e,g,null);f.flags|=2;d.return=b;f.return=b;d.sibling=f;b.child=d;0!==(b.mode&1)&&Ug(b,a.child,null,g);b.child.memoizedState=nj(g);b.memoizedState=mj;return f}if(0===(b.mode&1))return sj(a,b,g,null);if("$!"===e.data){d=e.nextSibling&&e.nextSibling.dataset;
	if(d)var h=d.dgst;d=h;f=Error(p$1(419));d=Ki(f,d,void 0);return sj(a,b,g,d)}h=0!==(g&a.childLanes);if(dh||h){d=Q;if(null!==d){switch(g&-g){case 4:e=2;break;case 16:e=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:e=32;break;case 536870912:e=268435456;break;default:e=0;}e=0!==(e&(d.suspendedLanes|g))?0:e;
	0!==e&&e!==f.retryLane&&(f.retryLane=e,ih(a,e),gi(d,a,e,-1));}tj();d=Ki(Error(p$1(421)));return sj(a,b,g,d)}if("$?"===e.data)return b.flags|=128,b.child=a.child,b=uj.bind(null,a),e._reactRetry=b,null;a=f.treeContext;yg=Lf(e.nextSibling);xg=b;I=!0;zg=null;null!==a&&(og[pg++]=rg,og[pg++]=sg,og[pg++]=qg,rg=a.id,sg=a.overflow,qg=b);b=qj(b,d.children);b.flags|=4096;return b}function vj(a,b,c){a.lanes|=b;var d=a.alternate;null!==d&&(d.lanes|=b);bh(a.return,b,c);}
	function wj(a,b,c,d,e){var f=a.memoizedState;null===f?a.memoizedState={isBackwards:b,rendering:null,renderingStartTime:0,last:d,tail:c,tailMode:e}:(f.isBackwards=b,f.rendering=null,f.renderingStartTime=0,f.last=d,f.tail=c,f.tailMode=e);}
	function xj(a,b,c){var d=b.pendingProps,e=d.revealOrder,f=d.tail;Xi(a,b,d.children,c);d=L.current;if(0!==(d&2))d=d&1|2,b.flags|=128;else {if(null!==a&&0!==(a.flags&128))a:for(a=b.child;null!==a;){if(13===a.tag)null!==a.memoizedState&&vj(a,c,b);else if(19===a.tag)vj(a,c,b);else if(null!==a.child){a.child.return=a;a=a.child;continue}if(a===b)break a;for(;null===a.sibling;){if(null===a.return||a.return===b)break a;a=a.return;}a.sibling.return=a.return;a=a.sibling;}d&=1;}G(L,d);if(0===(b.mode&1))b.memoizedState=
	null;else switch(e){case "forwards":c=b.child;for(e=null;null!==c;)a=c.alternate,null!==a&&null===Ch(a)&&(e=c),c=c.sibling;c=e;null===c?(e=b.child,b.child=null):(e=c.sibling,c.sibling=null);wj(b,!1,e,c,f);break;case "backwards":c=null;e=b.child;for(b.child=null;null!==e;){a=e.alternate;if(null!==a&&null===Ch(a)){b.child=e;break}a=e.sibling;e.sibling=c;c=e;e=a;}wj(b,!0,c,null,f);break;case "together":wj(b,!1,null,null,void 0);break;default:b.memoizedState=null;}return b.child}
	function ij(a,b){0===(b.mode&1)&&null!==a&&(a.alternate=null,b.alternate=null,b.flags|=2);}function Zi(a,b,c){null!==a&&(b.dependencies=a.dependencies);rh|=b.lanes;if(0===(c&b.childLanes))return null;if(null!==a&&b.child!==a.child)throw Error(p$1(153));if(null!==b.child){a=b.child;c=Pg(a,a.pendingProps);b.child=c;for(c.return=b;null!==a.sibling;)a=a.sibling,c=c.sibling=Pg(a,a.pendingProps),c.return=b;c.sibling=null;}return b.child}
	function yj(a,b,c){switch(b.tag){case 3:kj(b);Ig();break;case 5:Ah(b);break;case 1:Zf(b.type)&&cg(b);break;case 4:yh(b,b.stateNode.containerInfo);break;case 10:var d=b.type._context,e=b.memoizedProps.value;G(Wg,d._currentValue);d._currentValue=e;break;case 13:d=b.memoizedState;if(null!==d){if(null!==d.dehydrated)return G(L,L.current&1),b.flags|=128,null;if(0!==(c&b.child.childLanes))return oj(a,b,c);G(L,L.current&1);a=Zi(a,b,c);return null!==a?a.sibling:null}G(L,L.current&1);break;case 19:d=0!==(c&
	b.childLanes);if(0!==(a.flags&128)){if(d)return xj(a,b,c);b.flags|=128;}e=b.memoizedState;null!==e&&(e.rendering=null,e.tail=null,e.lastEffect=null);G(L,L.current);if(d)break;else return null;case 22:case 23:return b.lanes=0,dj(a,b,c)}return Zi(a,b,c)}var zj,Aj,Bj,Cj;
	zj=function(a,b){for(var c=b.child;null!==c;){if(5===c.tag||6===c.tag)a.appendChild(c.stateNode);else if(4!==c.tag&&null!==c.child){c.child.return=c;c=c.child;continue}if(c===b)break;for(;null===c.sibling;){if(null===c.return||c.return===b)return;c=c.return;}c.sibling.return=c.return;c=c.sibling;}};Aj=function(){};
	Bj=function(a,b,c,d){var e=a.memoizedProps;if(e!==d){a=b.stateNode;xh(uh.current);var f=null;switch(c){case "input":e=Ya(a,e);d=Ya(a,d);f=[];break;case "select":e=A({},e,{value:void 0});d=A({},d,{value:void 0});f=[];break;case "textarea":e=gb(a,e);d=gb(a,d);f=[];break;default:"function"!==typeof e.onClick&&"function"===typeof d.onClick&&(a.onclick=Bf);}ub(c,d);var g;c=null;for(l in e)if(!d.hasOwnProperty(l)&&e.hasOwnProperty(l)&&null!=e[l])if("style"===l){var h=e[l];for(g in h)h.hasOwnProperty(g)&&
	(c||(c={}),c[g]="");}else "dangerouslySetInnerHTML"!==l&&"children"!==l&&"suppressContentEditableWarning"!==l&&"suppressHydrationWarning"!==l&&"autoFocus"!==l&&(ea.hasOwnProperty(l)?f||(f=[]):(f=f||[]).push(l,null));for(l in d){var k=d[l];h=null!=e?e[l]:void 0;if(d.hasOwnProperty(l)&&k!==h&&(null!=k||null!=h))if("style"===l)if(h){for(g in h)!h.hasOwnProperty(g)||k&&k.hasOwnProperty(g)||(c||(c={}),c[g]="");for(g in k)k.hasOwnProperty(g)&&h[g]!==k[g]&&(c||(c={}),c[g]=k[g]);}else c||(f||(f=[]),f.push(l,
	c)),c=k;else "dangerouslySetInnerHTML"===l?(k=k?k.__html:void 0,h=h?h.__html:void 0,null!=k&&h!==k&&(f=f||[]).push(l,k)):"children"===l?"string"!==typeof k&&"number"!==typeof k||(f=f||[]).push(l,""+k):"suppressContentEditableWarning"!==l&&"suppressHydrationWarning"!==l&&(ea.hasOwnProperty(l)?(null!=k&&"onScroll"===l&&D("scroll",a),f||h===k||(f=[])):(f=f||[]).push(l,k));}c&&(f=f||[]).push("style",c);var l=f;if(b.updateQueue=l)b.flags|=4;}};Cj=function(a,b,c,d){c!==d&&(b.flags|=4);};
	function Dj(a,b){if(!I)switch(a.tailMode){case "hidden":b=a.tail;for(var c=null;null!==b;)null!==b.alternate&&(c=b),b=b.sibling;null===c?a.tail=null:c.sibling=null;break;case "collapsed":c=a.tail;for(var d=null;null!==c;)null!==c.alternate&&(d=c),c=c.sibling;null===d?b||null===a.tail?a.tail=null:a.tail.sibling=null:d.sibling=null;}}
	function S(a){var b=null!==a.alternate&&a.alternate.child===a.child,c=0,d=0;if(b)for(var e=a.child;null!==e;)c|=e.lanes|e.childLanes,d|=e.subtreeFlags&14680064,d|=e.flags&14680064,e.return=a,e=e.sibling;else for(e=a.child;null!==e;)c|=e.lanes|e.childLanes,d|=e.subtreeFlags,d|=e.flags,e.return=a,e=e.sibling;a.subtreeFlags|=d;a.childLanes=c;return b}
	function Ej(a,b,c){var d=b.pendingProps;wg(b);switch(b.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return S(b),null;case 1:return Zf(b.type)&&$f(),S(b),null;case 3:d=b.stateNode;zh();E(Wf);E(H);Eh();d.pendingContext&&(d.context=d.pendingContext,d.pendingContext=null);if(null===a||null===a.child)Gg(b)?b.flags|=4:null===a||a.memoizedState.isDehydrated&&0===(b.flags&256)||(b.flags|=1024,null!==zg&&(Fj(zg),zg=null));Aj(a,b);S(b);return null;case 5:Bh(b);var e=xh(wh.current);
	c=b.type;if(null!==a&&null!=b.stateNode)Bj(a,b,c,d,e),a.ref!==b.ref&&(b.flags|=512,b.flags|=2097152);else {if(!d){if(null===b.stateNode)throw Error(p$1(166));S(b);return null}a=xh(uh.current);if(Gg(b)){d=b.stateNode;c=b.type;var f=b.memoizedProps;d[Of]=b;d[Pf]=f;a=0!==(b.mode&1);switch(c){case "dialog":D("cancel",d);D("close",d);break;case "iframe":case "object":case "embed":D("load",d);break;case "video":case "audio":for(e=0;e<lf.length;e++)D(lf[e],d);break;case "source":D("error",d);break;case "img":case "image":case "link":D("error",
	d);D("load",d);break;case "details":D("toggle",d);break;case "input":Za(d,f);D("invalid",d);break;case "select":d._wrapperState={wasMultiple:!!f.multiple};D("invalid",d);break;case "textarea":hb(d,f),D("invalid",d);}ub(c,f);e=null;for(var g in f)if(f.hasOwnProperty(g)){var h=f[g];"children"===g?"string"===typeof h?d.textContent!==h&&(!0!==f.suppressHydrationWarning&&Af(d.textContent,h,a),e=["children",h]):"number"===typeof h&&d.textContent!==""+h&&(!0!==f.suppressHydrationWarning&&Af(d.textContent,
	h,a),e=["children",""+h]):ea.hasOwnProperty(g)&&null!=h&&"onScroll"===g&&D("scroll",d);}switch(c){case "input":Va(d);db(d,f,!0);break;case "textarea":Va(d);jb(d);break;case "select":case "option":break;default:"function"===typeof f.onClick&&(d.onclick=Bf);}d=e;b.updateQueue=d;null!==d&&(b.flags|=4);}else {g=9===e.nodeType?e:e.ownerDocument;"http://www.w3.org/1999/xhtml"===a&&(a=kb(c));"http://www.w3.org/1999/xhtml"===a?"script"===c?(a=g.createElement("div"),a.innerHTML="<script>\x3c/script>",a=a.removeChild(a.firstChild)):
	"string"===typeof d.is?a=g.createElement(c,{is:d.is}):(a=g.createElement(c),"select"===c&&(g=a,d.multiple?g.multiple=!0:d.size&&(g.size=d.size))):a=g.createElementNS(a,c);a[Of]=b;a[Pf]=d;zj(a,b,!1,!1);b.stateNode=a;a:{g=vb(c,d);switch(c){case "dialog":D("cancel",a);D("close",a);e=d;break;case "iframe":case "object":case "embed":D("load",a);e=d;break;case "video":case "audio":for(e=0;e<lf.length;e++)D(lf[e],a);e=d;break;case "source":D("error",a);e=d;break;case "img":case "image":case "link":D("error",
	a);D("load",a);e=d;break;case "details":D("toggle",a);e=d;break;case "input":Za(a,d);e=Ya(a,d);D("invalid",a);break;case "option":e=d;break;case "select":a._wrapperState={wasMultiple:!!d.multiple};e=A({},d,{value:void 0});D("invalid",a);break;case "textarea":hb(a,d);e=gb(a,d);D("invalid",a);break;default:e=d;}ub(c,e);h=e;for(f in h)if(h.hasOwnProperty(f)){var k=h[f];"style"===f?sb(a,k):"dangerouslySetInnerHTML"===f?(k=k?k.__html:void 0,null!=k&&nb(a,k)):"children"===f?"string"===typeof k?("textarea"!==
	c||""!==k)&&ob(a,k):"number"===typeof k&&ob(a,""+k):"suppressContentEditableWarning"!==f&&"suppressHydrationWarning"!==f&&"autoFocus"!==f&&(ea.hasOwnProperty(f)?null!=k&&"onScroll"===f&&D("scroll",a):null!=k&&ta(a,f,k,g));}switch(c){case "input":Va(a);db(a,d,!1);break;case "textarea":Va(a);jb(a);break;case "option":null!=d.value&&a.setAttribute("value",""+Sa(d.value));break;case "select":a.multiple=!!d.multiple;f=d.value;null!=f?fb(a,!!d.multiple,f,!1):null!=d.defaultValue&&fb(a,!!d.multiple,d.defaultValue,
	!0);break;default:"function"===typeof e.onClick&&(a.onclick=Bf);}switch(c){case "button":case "input":case "select":case "textarea":d=!!d.autoFocus;break a;case "img":d=!0;break a;default:d=!1;}}d&&(b.flags|=4);}null!==b.ref&&(b.flags|=512,b.flags|=2097152);}S(b);return null;case 6:if(a&&null!=b.stateNode)Cj(a,b,a.memoizedProps,d);else {if("string"!==typeof d&&null===b.stateNode)throw Error(p$1(166));c=xh(wh.current);xh(uh.current);if(Gg(b)){d=b.stateNode;c=b.memoizedProps;d[Of]=b;if(f=d.nodeValue!==c)if(a=
	xg,null!==a)switch(a.tag){case 3:Af(d.nodeValue,c,0!==(a.mode&1));break;case 5:!0!==a.memoizedProps.suppressHydrationWarning&&Af(d.nodeValue,c,0!==(a.mode&1));}f&&(b.flags|=4);}else d=(9===c.nodeType?c:c.ownerDocument).createTextNode(d),d[Of]=b,b.stateNode=d;}S(b);return null;case 13:E(L);d=b.memoizedState;if(null===a||null!==a.memoizedState&&null!==a.memoizedState.dehydrated){if(I&&null!==yg&&0!==(b.mode&1)&&0===(b.flags&128))Hg(),Ig(),b.flags|=98560,f=!1;else if(f=Gg(b),null!==d&&null!==d.dehydrated){if(null===
	a){if(!f)throw Error(p$1(318));f=b.memoizedState;f=null!==f?f.dehydrated:null;if(!f)throw Error(p$1(317));f[Of]=b;}else Ig(),0===(b.flags&128)&&(b.memoizedState=null),b.flags|=4;S(b);f=!1;}else null!==zg&&(Fj(zg),zg=null),f=!0;if(!f)return b.flags&65536?b:null}if(0!==(b.flags&128))return b.lanes=c,b;d=null!==d;d!==(null!==a&&null!==a.memoizedState)&&d&&(b.child.flags|=8192,0!==(b.mode&1)&&(null===a||0!==(L.current&1)?0===T&&(T=3):tj()));null!==b.updateQueue&&(b.flags|=4);S(b);return null;case 4:return zh(),
	Aj(a,b),null===a&&sf(b.stateNode.containerInfo),S(b),null;case 10:return ah(b.type._context),S(b),null;case 17:return Zf(b.type)&&$f(),S(b),null;case 19:E(L);f=b.memoizedState;if(null===f)return S(b),null;d=0!==(b.flags&128);g=f.rendering;if(null===g)if(d)Dj(f,!1);else {if(0!==T||null!==a&&0!==(a.flags&128))for(a=b.child;null!==a;){g=Ch(a);if(null!==g){b.flags|=128;Dj(f,!1);d=g.updateQueue;null!==d&&(b.updateQueue=d,b.flags|=4);b.subtreeFlags=0;d=c;for(c=b.child;null!==c;)f=c,a=d,f.flags&=14680066,
	g=f.alternate,null===g?(f.childLanes=0,f.lanes=a,f.child=null,f.subtreeFlags=0,f.memoizedProps=null,f.memoizedState=null,f.updateQueue=null,f.dependencies=null,f.stateNode=null):(f.childLanes=g.childLanes,f.lanes=g.lanes,f.child=g.child,f.subtreeFlags=0,f.deletions=null,f.memoizedProps=g.memoizedProps,f.memoizedState=g.memoizedState,f.updateQueue=g.updateQueue,f.type=g.type,a=g.dependencies,f.dependencies=null===a?null:{lanes:a.lanes,firstContext:a.firstContext}),c=c.sibling;G(L,L.current&1|2);return b.child}a=
	a.sibling;}null!==f.tail&&B()>Gj&&(b.flags|=128,d=!0,Dj(f,!1),b.lanes=4194304);}else {if(!d)if(a=Ch(g),null!==a){if(b.flags|=128,d=!0,c=a.updateQueue,null!==c&&(b.updateQueue=c,b.flags|=4),Dj(f,!0),null===f.tail&&"hidden"===f.tailMode&&!g.alternate&&!I)return S(b),null}else 2*B()-f.renderingStartTime>Gj&&1073741824!==c&&(b.flags|=128,d=!0,Dj(f,!1),b.lanes=4194304);f.isBackwards?(g.sibling=b.child,b.child=g):(c=f.last,null!==c?c.sibling=g:b.child=g,f.last=g);}if(null!==f.tail)return b=f.tail,f.rendering=
	b,f.tail=b.sibling,f.renderingStartTime=B(),b.sibling=null,c=L.current,G(L,d?c&1|2:c&1),b;S(b);return null;case 22:case 23:return Hj(),d=null!==b.memoizedState,null!==a&&null!==a.memoizedState!==d&&(b.flags|=8192),d&&0!==(b.mode&1)?0!==(fj&1073741824)&&(S(b),b.subtreeFlags&6&&(b.flags|=8192)):S(b),null;case 24:return null;case 25:return null}throw Error(p$1(156,b.tag));}
	function Ij(a,b){wg(b);switch(b.tag){case 1:return Zf(b.type)&&$f(),a=b.flags,a&65536?(b.flags=a&-65537|128,b):null;case 3:return zh(),E(Wf),E(H),Eh(),a=b.flags,0!==(a&65536)&&0===(a&128)?(b.flags=a&-65537|128,b):null;case 5:return Bh(b),null;case 13:E(L);a=b.memoizedState;if(null!==a&&null!==a.dehydrated){if(null===b.alternate)throw Error(p$1(340));Ig();}a=b.flags;return a&65536?(b.flags=a&-65537|128,b):null;case 19:return E(L),null;case 4:return zh(),null;case 10:return ah(b.type._context),null;case 22:case 23:return Hj(),
	null;case 24:return null;default:return null}}var Jj=!1,U=!1,Kj="function"===typeof WeakSet?WeakSet:Set,V=null;function Lj(a,b){var c=a.ref;if(null!==c)if("function"===typeof c)try{c(null);}catch(d){W(a,b,d);}else c.current=null;}function Mj(a,b,c){try{c();}catch(d){W(a,b,d);}}var Nj=!1;
	function Oj(a,b){Cf=dd;a=Me();if(Ne(a)){if("selectionStart"in a)var c={start:a.selectionStart,end:a.selectionEnd};else a:{c=(c=a.ownerDocument)&&c.defaultView||window;var d=c.getSelection&&c.getSelection();if(d&&0!==d.rangeCount){c=d.anchorNode;var e=d.anchorOffset,f=d.focusNode;d=d.focusOffset;try{c.nodeType,f.nodeType;}catch(F){c=null;break a}var g=0,h=-1,k=-1,l=0,m=0,q=a,r=null;b:for(;;){for(var y;;){q!==c||0!==e&&3!==q.nodeType||(h=g+e);q!==f||0!==d&&3!==q.nodeType||(k=g+d);3===q.nodeType&&(g+=
	q.nodeValue.length);if(null===(y=q.firstChild))break;r=q;q=y;}for(;;){if(q===a)break b;r===c&&++l===e&&(h=g);r===f&&++m===d&&(k=g);if(null!==(y=q.nextSibling))break;q=r;r=q.parentNode;}q=y;}c=-1===h||-1===k?null:{start:h,end:k};}else c=null;}c=c||{start:0,end:0};}else c=null;Df={focusedElem:a,selectionRange:c};dd=!1;for(V=b;null!==V;)if(b=V,a=b.child,0!==(b.subtreeFlags&1028)&&null!==a)a.return=b,V=a;else for(;null!==V;){b=V;try{var n=b.alternate;if(0!==(b.flags&1024))switch(b.tag){case 0:case 11:case 15:break;
	case 1:if(null!==n){var t=n.memoizedProps,J=n.memoizedState,x=b.stateNode,w=x.getSnapshotBeforeUpdate(b.elementType===b.type?t:Ci(b.type,t),J);x.__reactInternalSnapshotBeforeUpdate=w;}break;case 3:var u=b.stateNode.containerInfo;1===u.nodeType?u.textContent="":9===u.nodeType&&u.documentElement&&u.removeChild(u.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(p$1(163));}}catch(F){W(b,b.return,F);}a=b.sibling;if(null!==a){a.return=b.return;V=a;break}V=b.return;}n=Nj;Nj=!1;return n}
	function Pj(a,b,c){var d=b.updateQueue;d=null!==d?d.lastEffect:null;if(null!==d){var e=d=d.next;do{if((e.tag&a)===a){var f=e.destroy;e.destroy=void 0;void 0!==f&&Mj(b,c,f);}e=e.next;}while(e!==d)}}function Qj(a,b){b=b.updateQueue;b=null!==b?b.lastEffect:null;if(null!==b){var c=b=b.next;do{if((c.tag&a)===a){var d=c.create;c.destroy=d();}c=c.next;}while(c!==b)}}function Rj(a){var b=a.ref;if(null!==b){var c=a.stateNode;switch(a.tag){case 5:a=c;break;default:a=c;}"function"===typeof b?b(a):b.current=a;}}
	function Sj(a){var b=a.alternate;null!==b&&(a.alternate=null,Sj(b));a.child=null;a.deletions=null;a.sibling=null;5===a.tag&&(b=a.stateNode,null!==b&&(delete b[Of],delete b[Pf],delete b[of],delete b[Qf],delete b[Rf]));a.stateNode=null;a.return=null;a.dependencies=null;a.memoizedProps=null;a.memoizedState=null;a.pendingProps=null;a.stateNode=null;a.updateQueue=null;}function Tj(a){return 5===a.tag||3===a.tag||4===a.tag}
	function Uj(a){a:for(;;){for(;null===a.sibling;){if(null===a.return||Tj(a.return))return null;a=a.return;}a.sibling.return=a.return;for(a=a.sibling;5!==a.tag&&6!==a.tag&&18!==a.tag;){if(a.flags&2)continue a;if(null===a.child||4===a.tag)continue a;else a.child.return=a,a=a.child;}if(!(a.flags&2))return a.stateNode}}
	function Vj(a,b,c){var d=a.tag;if(5===d||6===d)a=a.stateNode,b?8===c.nodeType?c.parentNode.insertBefore(a,b):c.insertBefore(a,b):(8===c.nodeType?(b=c.parentNode,b.insertBefore(a,c)):(b=c,b.appendChild(a)),c=c._reactRootContainer,null!==c&&void 0!==c||null!==b.onclick||(b.onclick=Bf));else if(4!==d&&(a=a.child,null!==a))for(Vj(a,b,c),a=a.sibling;null!==a;)Vj(a,b,c),a=a.sibling;}
	function Wj(a,b,c){var d=a.tag;if(5===d||6===d)a=a.stateNode,b?c.insertBefore(a,b):c.appendChild(a);else if(4!==d&&(a=a.child,null!==a))for(Wj(a,b,c),a=a.sibling;null!==a;)Wj(a,b,c),a=a.sibling;}var X=null,Xj=!1;function Yj(a,b,c){for(c=c.child;null!==c;)Zj(a,b,c),c=c.sibling;}
	function Zj(a,b,c){if(lc&&"function"===typeof lc.onCommitFiberUnmount)try{lc.onCommitFiberUnmount(kc,c);}catch(h){}switch(c.tag){case 5:U||Lj(c,b);case 6:var d=X,e=Xj;X=null;Yj(a,b,c);X=d;Xj=e;null!==X&&(Xj?(a=X,c=c.stateNode,8===a.nodeType?a.parentNode.removeChild(c):a.removeChild(c)):X.removeChild(c.stateNode));break;case 18:null!==X&&(Xj?(a=X,c=c.stateNode,8===a.nodeType?Kf(a.parentNode,c):1===a.nodeType&&Kf(a,c),bd(a)):Kf(X,c.stateNode));break;case 4:d=X;e=Xj;X=c.stateNode.containerInfo;Xj=!0;
	Yj(a,b,c);X=d;Xj=e;break;case 0:case 11:case 14:case 15:if(!U&&(d=c.updateQueue,null!==d&&(d=d.lastEffect,null!==d))){e=d=d.next;do{var f=e,g=f.destroy;f=f.tag;void 0!==g&&(0!==(f&2)?Mj(c,b,g):0!==(f&4)&&Mj(c,b,g));e=e.next;}while(e!==d)}Yj(a,b,c);break;case 1:if(!U&&(Lj(c,b),d=c.stateNode,"function"===typeof d.componentWillUnmount))try{d.props=c.memoizedProps,d.state=c.memoizedState,d.componentWillUnmount();}catch(h){W(c,b,h);}Yj(a,b,c);break;case 21:Yj(a,b,c);break;case 22:c.mode&1?(U=(d=U)||null!==
	c.memoizedState,Yj(a,b,c),U=d):Yj(a,b,c);break;default:Yj(a,b,c);}}function ak(a){var b=a.updateQueue;if(null!==b){a.updateQueue=null;var c=a.stateNode;null===c&&(c=a.stateNode=new Kj);b.forEach(function(b){var d=bk.bind(null,a,b);c.has(b)||(c.add(b),b.then(d,d));});}}
	function ck(a,b){var c=b.deletions;if(null!==c)for(var d=0;d<c.length;d++){var e=c[d];try{var f=a,g=b,h=g;a:for(;null!==h;){switch(h.tag){case 5:X=h.stateNode;Xj=!1;break a;case 3:X=h.stateNode.containerInfo;Xj=!0;break a;case 4:X=h.stateNode.containerInfo;Xj=!0;break a}h=h.return;}if(null===X)throw Error(p$1(160));Zj(f,g,e);X=null;Xj=!1;var k=e.alternate;null!==k&&(k.return=null);e.return=null;}catch(l){W(e,b,l);}}if(b.subtreeFlags&12854)for(b=b.child;null!==b;)dk(b,a),b=b.sibling;}
	function dk(a,b){var c=a.alternate,d=a.flags;switch(a.tag){case 0:case 11:case 14:case 15:ck(b,a);ek(a);if(d&4){try{Pj(3,a,a.return),Qj(3,a);}catch(t){W(a,a.return,t);}try{Pj(5,a,a.return);}catch(t){W(a,a.return,t);}}break;case 1:ck(b,a);ek(a);d&512&&null!==c&&Lj(c,c.return);break;case 5:ck(b,a);ek(a);d&512&&null!==c&&Lj(c,c.return);if(a.flags&32){var e=a.stateNode;try{ob(e,"");}catch(t){W(a,a.return,t);}}if(d&4&&(e=a.stateNode,null!=e)){var f=a.memoizedProps,g=null!==c?c.memoizedProps:f,h=a.type,k=a.updateQueue;
	a.updateQueue=null;if(null!==k)try{"input"===h&&"radio"===f.type&&null!=f.name&&ab(e,f);vb(h,g);var l=vb(h,f);for(g=0;g<k.length;g+=2){var m=k[g],q=k[g+1];"style"===m?sb(e,q):"dangerouslySetInnerHTML"===m?nb(e,q):"children"===m?ob(e,q):ta(e,m,q,l);}switch(h){case "input":bb(e,f);break;case "textarea":ib(e,f);break;case "select":var r=e._wrapperState.wasMultiple;e._wrapperState.wasMultiple=!!f.multiple;var y=f.value;null!=y?fb(e,!!f.multiple,y,!1):r!==!!f.multiple&&(null!=f.defaultValue?fb(e,!!f.multiple,
	f.defaultValue,!0):fb(e,!!f.multiple,f.multiple?[]:"",!1));}e[Pf]=f;}catch(t){W(a,a.return,t);}}break;case 6:ck(b,a);ek(a);if(d&4){if(null===a.stateNode)throw Error(p$1(162));e=a.stateNode;f=a.memoizedProps;try{e.nodeValue=f;}catch(t){W(a,a.return,t);}}break;case 3:ck(b,a);ek(a);if(d&4&&null!==c&&c.memoizedState.isDehydrated)try{bd(b.containerInfo);}catch(t){W(a,a.return,t);}break;case 4:ck(b,a);ek(a);break;case 13:ck(b,a);ek(a);e=a.child;e.flags&8192&&(f=null!==e.memoizedState,e.stateNode.isHidden=f,!f||
	null!==e.alternate&&null!==e.alternate.memoizedState||(fk=B()));d&4&&ak(a);break;case 22:m=null!==c&&null!==c.memoizedState;a.mode&1?(U=(l=U)||m,ck(b,a),U=l):ck(b,a);ek(a);if(d&8192){l=null!==a.memoizedState;if((a.stateNode.isHidden=l)&&!m&&0!==(a.mode&1))for(V=a,m=a.child;null!==m;){for(q=V=m;null!==V;){r=V;y=r.child;switch(r.tag){case 0:case 11:case 14:case 15:Pj(4,r,r.return);break;case 1:Lj(r,r.return);var n=r.stateNode;if("function"===typeof n.componentWillUnmount){d=r;c=r.return;try{b=d,n.props=
	b.memoizedProps,n.state=b.memoizedState,n.componentWillUnmount();}catch(t){W(d,c,t);}}break;case 5:Lj(r,r.return);break;case 22:if(null!==r.memoizedState){gk(q);continue}}null!==y?(y.return=r,V=y):gk(q);}m=m.sibling;}a:for(m=null,q=a;;){if(5===q.tag){if(null===m){m=q;try{e=q.stateNode,l?(f=e.style,"function"===typeof f.setProperty?f.setProperty("display","none","important"):f.display="none"):(h=q.stateNode,k=q.memoizedProps.style,g=void 0!==k&&null!==k&&k.hasOwnProperty("display")?k.display:null,h.style.display=
	rb("display",g));}catch(t){W(a,a.return,t);}}}else if(6===q.tag){if(null===m)try{q.stateNode.nodeValue=l?"":q.memoizedProps;}catch(t){W(a,a.return,t);}}else if((22!==q.tag&&23!==q.tag||null===q.memoizedState||q===a)&&null!==q.child){q.child.return=q;q=q.child;continue}if(q===a)break a;for(;null===q.sibling;){if(null===q.return||q.return===a)break a;m===q&&(m=null);q=q.return;}m===q&&(m=null);q.sibling.return=q.return;q=q.sibling;}}break;case 19:ck(b,a);ek(a);d&4&&ak(a);break;case 21:break;default:ck(b,
	a),ek(a);}}function ek(a){var b=a.flags;if(b&2){try{a:{for(var c=a.return;null!==c;){if(Tj(c)){var d=c;break a}c=c.return;}throw Error(p$1(160));}switch(d.tag){case 5:var e=d.stateNode;d.flags&32&&(ob(e,""),d.flags&=-33);var f=Uj(a);Wj(a,f,e);break;case 3:case 4:var g=d.stateNode.containerInfo,h=Uj(a);Vj(a,h,g);break;default:throw Error(p$1(161));}}catch(k){W(a,a.return,k);}a.flags&=-3;}b&4096&&(a.flags&=-4097);}function hk(a,b,c){V=a;ik(a);}
	function ik(a,b,c){for(var d=0!==(a.mode&1);null!==V;){var e=V,f=e.child;if(22===e.tag&&d){var g=null!==e.memoizedState||Jj;if(!g){var h=e.alternate,k=null!==h&&null!==h.memoizedState||U;h=Jj;var l=U;Jj=g;if((U=k)&&!l)for(V=e;null!==V;)g=V,k=g.child,22===g.tag&&null!==g.memoizedState?jk(e):null!==k?(k.return=g,V=k):jk(e);for(;null!==f;)V=f,ik(f),f=f.sibling;V=e;Jj=h;U=l;}kk(a);}else 0!==(e.subtreeFlags&8772)&&null!==f?(f.return=e,V=f):kk(a);}}
	function kk(a){for(;null!==V;){var b=V;if(0!==(b.flags&8772)){var c=b.alternate;try{if(0!==(b.flags&8772))switch(b.tag){case 0:case 11:case 15:U||Qj(5,b);break;case 1:var d=b.stateNode;if(b.flags&4&&!U)if(null===c)d.componentDidMount();else {var e=b.elementType===b.type?c.memoizedProps:Ci(b.type,c.memoizedProps);d.componentDidUpdate(e,c.memoizedState,d.__reactInternalSnapshotBeforeUpdate);}var f=b.updateQueue;null!==f&&sh(b,f,d);break;case 3:var g=b.updateQueue;if(null!==g){c=null;if(null!==b.child)switch(b.child.tag){case 5:c=
	b.child.stateNode;break;case 1:c=b.child.stateNode;}sh(b,g,c);}break;case 5:var h=b.stateNode;if(null===c&&b.flags&4){c=h;var k=b.memoizedProps;switch(b.type){case "button":case "input":case "select":case "textarea":k.autoFocus&&c.focus();break;case "img":k.src&&(c.src=k.src);}}break;case 6:break;case 4:break;case 12:break;case 13:if(null===b.memoizedState){var l=b.alternate;if(null!==l){var m=l.memoizedState;if(null!==m){var q=m.dehydrated;null!==q&&bd(q);}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;
	default:throw Error(p$1(163));}U||b.flags&512&&Rj(b);}catch(r){W(b,b.return,r);}}if(b===a){V=null;break}c=b.sibling;if(null!==c){c.return=b.return;V=c;break}V=b.return;}}function gk(a){for(;null!==V;){var b=V;if(b===a){V=null;break}var c=b.sibling;if(null!==c){c.return=b.return;V=c;break}V=b.return;}}
	function jk(a){for(;null!==V;){var b=V;try{switch(b.tag){case 0:case 11:case 15:var c=b.return;try{Qj(4,b);}catch(k){W(b,c,k);}break;case 1:var d=b.stateNode;if("function"===typeof d.componentDidMount){var e=b.return;try{d.componentDidMount();}catch(k){W(b,e,k);}}var f=b.return;try{Rj(b);}catch(k){W(b,f,k);}break;case 5:var g=b.return;try{Rj(b);}catch(k){W(b,g,k);}}}catch(k){W(b,b.return,k);}if(b===a){V=null;break}var h=b.sibling;if(null!==h){h.return=b.return;V=h;break}V=b.return;}}
	var lk=Math.ceil,mk=ua.ReactCurrentDispatcher,nk=ua.ReactCurrentOwner,ok=ua.ReactCurrentBatchConfig,K=0,Q=null,Y=null,Z=0,fj=0,ej=Uf(0),T=0,pk=null,rh=0,qk=0,rk=0,sk=null,tk=null,fk=0,Gj=Infinity,uk=null,Oi=!1,Pi=null,Ri=null,vk=!1,wk=null,xk=0,yk=0,zk=null,Ak=-1,Bk=0;function R(){return 0!==(K&6)?B():-1!==Ak?Ak:Ak=B()}
	function yi(a){if(0===(a.mode&1))return 1;if(0!==(K&2)&&0!==Z)return Z&-Z;if(null!==Kg.transition)return 0===Bk&&(Bk=yc()),Bk;a=C;if(0!==a)return a;a=window.event;a=void 0===a?16:jd(a.type);return a}function gi(a,b,c,d){if(50<yk)throw yk=0,zk=null,Error(p$1(185));Ac(a,c,d);if(0===(K&2)||a!==Q)a===Q&&(0===(K&2)&&(qk|=c),4===T&&Ck(a,Z)),Dk(a,d),1===c&&0===K&&0===(b.mode&1)&&(Gj=B()+500,fg&&jg());}
	function Dk(a,b){var c=a.callbackNode;wc(a,b);var d=uc(a,a===Q?Z:0);if(0===d)null!==c&&bc(c),a.callbackNode=null,a.callbackPriority=0;else if(b=d&-d,a.callbackPriority!==b){null!=c&&bc(c);if(1===b)0===a.tag?ig(Ek.bind(null,a)):hg(Ek.bind(null,a)),Jf(function(){0===(K&6)&&jg();}),c=null;else {switch(Dc(d)){case 1:c=fc;break;case 4:c=gc;break;case 16:c=hc;break;case 536870912:c=jc;break;default:c=hc;}c=Fk(c,Gk.bind(null,a));}a.callbackPriority=b;a.callbackNode=c;}}
	function Gk(a,b){Ak=-1;Bk=0;if(0!==(K&6))throw Error(p$1(327));var c=a.callbackNode;if(Hk()&&a.callbackNode!==c)return null;var d=uc(a,a===Q?Z:0);if(0===d)return null;if(0!==(d&30)||0!==(d&a.expiredLanes)||b)b=Ik(a,d);else {b=d;var e=K;K|=2;var f=Jk();if(Q!==a||Z!==b)uk=null,Gj=B()+500,Kk(a,b);do try{Lk();break}catch(h){Mk(a,h);}while(1);$g();mk.current=f;K=e;null!==Y?b=0:(Q=null,Z=0,b=T);}if(0!==b){2===b&&(e=xc(a),0!==e&&(d=e,b=Nk(a,e)));if(1===b)throw c=pk,Kk(a,0),Ck(a,d),Dk(a,B()),c;if(6===b)Ck(a,d);
	else {e=a.current.alternate;if(0===(d&30)&&!Ok(e)&&(b=Ik(a,d),2===b&&(f=xc(a),0!==f&&(d=f,b=Nk(a,f))),1===b))throw c=pk,Kk(a,0),Ck(a,d),Dk(a,B()),c;a.finishedWork=e;a.finishedLanes=d;switch(b){case 0:case 1:throw Error(p$1(345));case 2:Pk(a,tk,uk);break;case 3:Ck(a,d);if((d&130023424)===d&&(b=fk+500-B(),10<b)){if(0!==uc(a,0))break;e=a.suspendedLanes;if((e&d)!==d){R();a.pingedLanes|=a.suspendedLanes&e;break}a.timeoutHandle=Ff(Pk.bind(null,a,tk,uk),b);break}Pk(a,tk,uk);break;case 4:Ck(a,d);if((d&4194240)===
	d)break;b=a.eventTimes;for(e=-1;0<d;){var g=31-oc(d);f=1<<g;g=b[g];g>e&&(e=g);d&=~f;}d=e;d=B()-d;d=(120>d?120:480>d?480:1080>d?1080:1920>d?1920:3E3>d?3E3:4320>d?4320:1960*lk(d/1960))-d;if(10<d){a.timeoutHandle=Ff(Pk.bind(null,a,tk,uk),d);break}Pk(a,tk,uk);break;case 5:Pk(a,tk,uk);break;default:throw Error(p$1(329));}}}Dk(a,B());return a.callbackNode===c?Gk.bind(null,a):null}
	function Nk(a,b){var c=sk;a.current.memoizedState.isDehydrated&&(Kk(a,b).flags|=256);a=Ik(a,b);2!==a&&(b=tk,tk=c,null!==b&&Fj(b));return a}function Fj(a){null===tk?tk=a:tk.push.apply(tk,a);}
	function Ok(a){for(var b=a;;){if(b.flags&16384){var c=b.updateQueue;if(null!==c&&(c=c.stores,null!==c))for(var d=0;d<c.length;d++){var e=c[d],f=e.getSnapshot;e=e.value;try{if(!He(f(),e))return !1}catch(g){return !1}}}c=b.child;if(b.subtreeFlags&16384&&null!==c)c.return=b,b=c;else {if(b===a)break;for(;null===b.sibling;){if(null===b.return||b.return===a)return !0;b=b.return;}b.sibling.return=b.return;b=b.sibling;}}return !0}
	function Ck(a,b){b&=~rk;b&=~qk;a.suspendedLanes|=b;a.pingedLanes&=~b;for(a=a.expirationTimes;0<b;){var c=31-oc(b),d=1<<c;a[c]=-1;b&=~d;}}function Ek(a){if(0!==(K&6))throw Error(p$1(327));Hk();var b=uc(a,0);if(0===(b&1))return Dk(a,B()),null;var c=Ik(a,b);if(0!==a.tag&&2===c){var d=xc(a);0!==d&&(b=d,c=Nk(a,d));}if(1===c)throw c=pk,Kk(a,0),Ck(a,b),Dk(a,B()),c;if(6===c)throw Error(p$1(345));a.finishedWork=a.current.alternate;a.finishedLanes=b;Pk(a,tk,uk);Dk(a,B());return null}
	function Qk(a,b){var c=K;K|=1;try{return a(b)}finally{K=c,0===K&&(Gj=B()+500,fg&&jg());}}function Rk(a){null!==wk&&0===wk.tag&&0===(K&6)&&Hk();var b=K;K|=1;var c=ok.transition,d=C;try{if(ok.transition=null,C=1,a)return a()}finally{C=d,ok.transition=c,K=b,0===(K&6)&&jg();}}function Hj(){fj=ej.current;E(ej);}
	function Kk(a,b){a.finishedWork=null;a.finishedLanes=0;var c=a.timeoutHandle;-1!==c&&(a.timeoutHandle=-1,Gf(c));if(null!==Y)for(c=Y.return;null!==c;){var d=c;wg(d);switch(d.tag){case 1:d=d.type.childContextTypes;null!==d&&void 0!==d&&$f();break;case 3:zh();E(Wf);E(H);Eh();break;case 5:Bh(d);break;case 4:zh();break;case 13:E(L);break;case 19:E(L);break;case 10:ah(d.type._context);break;case 22:case 23:Hj();}c=c.return;}Q=a;Y=a=Pg(a.current,null);Z=fj=b;T=0;pk=null;rk=qk=rh=0;tk=sk=null;if(null!==fh){for(b=
	0;b<fh.length;b++)if(c=fh[b],d=c.interleaved,null!==d){c.interleaved=null;var e=d.next,f=c.pending;if(null!==f){var g=f.next;f.next=e;d.next=g;}c.pending=d;}fh=null;}return a}
	function Mk(a,b){do{var c=Y;try{$g();Fh.current=Rh;if(Ih){for(var d=M.memoizedState;null!==d;){var e=d.queue;null!==e&&(e.pending=null);d=d.next;}Ih=!1;}Hh=0;O=N=M=null;Jh=!1;Kh=0;nk.current=null;if(null===c||null===c.return){T=1;pk=b;Y=null;break}a:{var f=a,g=c.return,h=c,k=b;b=Z;h.flags|=32768;if(null!==k&&"object"===typeof k&&"function"===typeof k.then){var l=k,m=h,q=m.tag;if(0===(m.mode&1)&&(0===q||11===q||15===q)){var r=m.alternate;r?(m.updateQueue=r.updateQueue,m.memoizedState=r.memoizedState,
	m.lanes=r.lanes):(m.updateQueue=null,m.memoizedState=null);}var y=Ui(g);if(null!==y){y.flags&=-257;Vi(y,g,h,f,b);y.mode&1&&Si(f,l,b);b=y;k=l;var n=b.updateQueue;if(null===n){var t=new Set;t.add(k);b.updateQueue=t;}else n.add(k);break a}else {if(0===(b&1)){Si(f,l,b);tj();break a}k=Error(p$1(426));}}else if(I&&h.mode&1){var J=Ui(g);if(null!==J){0===(J.flags&65536)&&(J.flags|=256);Vi(J,g,h,f,b);Jg(Ji(k,h));break a}}f=k=Ji(k,h);4!==T&&(T=2);null===sk?sk=[f]:sk.push(f);f=g;do{switch(f.tag){case 3:f.flags|=65536;
	b&=-b;f.lanes|=b;var x=Ni(f,k,b);ph(f,x);break a;case 1:h=k;var w=f.type,u=f.stateNode;if(0===(f.flags&128)&&("function"===typeof w.getDerivedStateFromError||null!==u&&"function"===typeof u.componentDidCatch&&(null===Ri||!Ri.has(u)))){f.flags|=65536;b&=-b;f.lanes|=b;var F=Qi(f,h,b);ph(f,F);break a}}f=f.return;}while(null!==f)}Sk(c);}catch(na){b=na;Y===c&&null!==c&&(Y=c=c.return);continue}break}while(1)}function Jk(){var a=mk.current;mk.current=Rh;return null===a?Rh:a}
	function tj(){if(0===T||3===T||2===T)T=4;null===Q||0===(rh&268435455)&&0===(qk&268435455)||Ck(Q,Z);}function Ik(a,b){var c=K;K|=2;var d=Jk();if(Q!==a||Z!==b)uk=null,Kk(a,b);do try{Tk();break}catch(e){Mk(a,e);}while(1);$g();K=c;mk.current=d;if(null!==Y)throw Error(p$1(261));Q=null;Z=0;return T}function Tk(){for(;null!==Y;)Uk(Y);}function Lk(){for(;null!==Y&&!cc();)Uk(Y);}function Uk(a){var b=Vk(a.alternate,a,fj);a.memoizedProps=a.pendingProps;null===b?Sk(a):Y=b;nk.current=null;}
	function Sk(a){var b=a;do{var c=b.alternate;a=b.return;if(0===(b.flags&32768)){if(c=Ej(c,b,fj),null!==c){Y=c;return}}else {c=Ij(c,b);if(null!==c){c.flags&=32767;Y=c;return}if(null!==a)a.flags|=32768,a.subtreeFlags=0,a.deletions=null;else {T=6;Y=null;return}}b=b.sibling;if(null!==b){Y=b;return}Y=b=a;}while(null!==b);0===T&&(T=5);}function Pk(a,b,c){var d=C,e=ok.transition;try{ok.transition=null,C=1,Wk(a,b,c,d);}finally{ok.transition=e,C=d;}return null}
	function Wk(a,b,c,d){do Hk();while(null!==wk);if(0!==(K&6))throw Error(p$1(327));c=a.finishedWork;var e=a.finishedLanes;if(null===c)return null;a.finishedWork=null;a.finishedLanes=0;if(c===a.current)throw Error(p$1(177));a.callbackNode=null;a.callbackPriority=0;var f=c.lanes|c.childLanes;Bc(a,f);a===Q&&(Y=Q=null,Z=0);0===(c.subtreeFlags&2064)&&0===(c.flags&2064)||vk||(vk=!0,Fk(hc,function(){Hk();return null}));f=0!==(c.flags&15990);if(0!==(c.subtreeFlags&15990)||f){f=ok.transition;ok.transition=null;
	var g=C;C=1;var h=K;K|=4;nk.current=null;Oj(a,c);dk(c,a);Oe(Df);dd=!!Cf;Df=Cf=null;a.current=c;hk(c);dc();K=h;C=g;ok.transition=f;}else a.current=c;vk&&(vk=!1,wk=a,xk=e);f=a.pendingLanes;0===f&&(Ri=null);mc(c.stateNode);Dk(a,B());if(null!==b)for(d=a.onRecoverableError,c=0;c<b.length;c++)e=b[c],d(e.value,{componentStack:e.stack,digest:e.digest});if(Oi)throw Oi=!1,a=Pi,Pi=null,a;0!==(xk&1)&&0!==a.tag&&Hk();f=a.pendingLanes;0!==(f&1)?a===zk?yk++:(yk=0,zk=a):yk=0;jg();return null}
	function Hk(){if(null!==wk){var a=Dc(xk),b=ok.transition,c=C;try{ok.transition=null;C=16>a?16:a;if(null===wk)var d=!1;else {a=wk;wk=null;xk=0;if(0!==(K&6))throw Error(p$1(331));var e=K;K|=4;for(V=a.current;null!==V;){var f=V,g=f.child;if(0!==(V.flags&16)){var h=f.deletions;if(null!==h){for(var k=0;k<h.length;k++){var l=h[k];for(V=l;null!==V;){var m=V;switch(m.tag){case 0:case 11:case 15:Pj(8,m,f);}var q=m.child;if(null!==q)q.return=m,V=q;else for(;null!==V;){m=V;var r=m.sibling,y=m.return;Sj(m);if(m===
	l){V=null;break}if(null!==r){r.return=y;V=r;break}V=y;}}}var n=f.alternate;if(null!==n){var t=n.child;if(null!==t){n.child=null;do{var J=t.sibling;t.sibling=null;t=J;}while(null!==t)}}V=f;}}if(0!==(f.subtreeFlags&2064)&&null!==g)g.return=f,V=g;else b:for(;null!==V;){f=V;if(0!==(f.flags&2048))switch(f.tag){case 0:case 11:case 15:Pj(9,f,f.return);}var x=f.sibling;if(null!==x){x.return=f.return;V=x;break b}V=f.return;}}var w=a.current;for(V=w;null!==V;){g=V;var u=g.child;if(0!==(g.subtreeFlags&2064)&&null!==
	u)u.return=g,V=u;else b:for(g=w;null!==V;){h=V;if(0!==(h.flags&2048))try{switch(h.tag){case 0:case 11:case 15:Qj(9,h);}}catch(na){W(h,h.return,na);}if(h===g){V=null;break b}var F=h.sibling;if(null!==F){F.return=h.return;V=F;break b}V=h.return;}}K=e;jg();if(lc&&"function"===typeof lc.onPostCommitFiberRoot)try{lc.onPostCommitFiberRoot(kc,a);}catch(na){}d=!0;}return d}finally{C=c,ok.transition=b;}}return !1}function Xk(a,b,c){b=Ji(c,b);b=Ni(a,b,1);a=nh(a,b,1);b=R();null!==a&&(Ac(a,1,b),Dk(a,b));}
	function W(a,b,c){if(3===a.tag)Xk(a,a,c);else for(;null!==b;){if(3===b.tag){Xk(b,a,c);break}else if(1===b.tag){var d=b.stateNode;if("function"===typeof b.type.getDerivedStateFromError||"function"===typeof d.componentDidCatch&&(null===Ri||!Ri.has(d))){a=Ji(c,a);a=Qi(b,a,1);b=nh(b,a,1);a=R();null!==b&&(Ac(b,1,a),Dk(b,a));break}}b=b.return;}}
	function Ti(a,b,c){var d=a.pingCache;null!==d&&d.delete(b);b=R();a.pingedLanes|=a.suspendedLanes&c;Q===a&&(Z&c)===c&&(4===T||3===T&&(Z&130023424)===Z&&500>B()-fk?Kk(a,0):rk|=c);Dk(a,b);}function Yk(a,b){0===b&&(0===(a.mode&1)?b=1:(b=sc,sc<<=1,0===(sc&130023424)&&(sc=4194304)));var c=R();a=ih(a,b);null!==a&&(Ac(a,b,c),Dk(a,c));}function uj(a){var b=a.memoizedState,c=0;null!==b&&(c=b.retryLane);Yk(a,c);}
	function bk(a,b){var c=0;switch(a.tag){case 13:var d=a.stateNode;var e=a.memoizedState;null!==e&&(c=e.retryLane);break;case 19:d=a.stateNode;break;default:throw Error(p$1(314));}null!==d&&d.delete(b);Yk(a,c);}var Vk;
	Vk=function(a,b,c){if(null!==a)if(a.memoizedProps!==b.pendingProps||Wf.current)dh=!0;else {if(0===(a.lanes&c)&&0===(b.flags&128))return dh=!1,yj(a,b,c);dh=0!==(a.flags&131072)?!0:!1;}else dh=!1,I&&0!==(b.flags&1048576)&&ug(b,ng,b.index);b.lanes=0;switch(b.tag){case 2:var d=b.type;ij(a,b);a=b.pendingProps;var e=Yf(b,H.current);ch(b,c);e=Nh(null,b,d,a,e,c);var f=Sh();b.flags|=1;"object"===typeof e&&null!==e&&"function"===typeof e.render&&void 0===e.$$typeof?(b.tag=1,b.memoizedState=null,b.updateQueue=
	null,Zf(d)?(f=!0,cg(b)):f=!1,b.memoizedState=null!==e.state&&void 0!==e.state?e.state:null,kh(b),e.updater=Ei,b.stateNode=e,e._reactInternals=b,Ii(b,d,a,c),b=jj(null,b,d,!0,f,c)):(b.tag=0,I&&f&&vg(b),Xi(null,b,e,c),b=b.child);return b;case 16:d=b.elementType;a:{ij(a,b);a=b.pendingProps;e=d._init;d=e(d._payload);b.type=d;e=b.tag=Zk(d);a=Ci(d,a);switch(e){case 0:b=cj(null,b,d,a,c);break a;case 1:b=hj(null,b,d,a,c);break a;case 11:b=Yi(null,b,d,a,c);break a;case 14:b=$i(null,b,d,Ci(d.type,a),c);break a}throw Error(p$1(306,
	d,""));}return b;case 0:return d=b.type,e=b.pendingProps,e=b.elementType===d?e:Ci(d,e),cj(a,b,d,e,c);case 1:return d=b.type,e=b.pendingProps,e=b.elementType===d?e:Ci(d,e),hj(a,b,d,e,c);case 3:a:{kj(b);if(null===a)throw Error(p$1(387));d=b.pendingProps;f=b.memoizedState;e=f.element;lh(a,b);qh(b,d,null,c);var g=b.memoizedState;d=g.element;if(f.isDehydrated)if(f={element:d,isDehydrated:!1,cache:g.cache,pendingSuspenseBoundaries:g.pendingSuspenseBoundaries,transitions:g.transitions},b.updateQueue.baseState=
	f,b.memoizedState=f,b.flags&256){e=Ji(Error(p$1(423)),b);b=lj(a,b,d,c,e);break a}else if(d!==e){e=Ji(Error(p$1(424)),b);b=lj(a,b,d,c,e);break a}else for(yg=Lf(b.stateNode.containerInfo.firstChild),xg=b,I=!0,zg=null,c=Vg(b,null,d,c),b.child=c;c;)c.flags=c.flags&-3|4096,c=c.sibling;else {Ig();if(d===e){b=Zi(a,b,c);break a}Xi(a,b,d,c);}b=b.child;}return b;case 5:return Ah(b),null===a&&Eg(b),d=b.type,e=b.pendingProps,f=null!==a?a.memoizedProps:null,g=e.children,Ef(d,e)?g=null:null!==f&&Ef(d,f)&&(b.flags|=32),
	gj(a,b),Xi(a,b,g,c),b.child;case 6:return null===a&&Eg(b),null;case 13:return oj(a,b,c);case 4:return yh(b,b.stateNode.containerInfo),d=b.pendingProps,null===a?b.child=Ug(b,null,d,c):Xi(a,b,d,c),b.child;case 11:return d=b.type,e=b.pendingProps,e=b.elementType===d?e:Ci(d,e),Yi(a,b,d,e,c);case 7:return Xi(a,b,b.pendingProps,c),b.child;case 8:return Xi(a,b,b.pendingProps.children,c),b.child;case 12:return Xi(a,b,b.pendingProps.children,c),b.child;case 10:a:{d=b.type._context;e=b.pendingProps;f=b.memoizedProps;
	g=e.value;G(Wg,d._currentValue);d._currentValue=g;if(null!==f)if(He(f.value,g)){if(f.children===e.children&&!Wf.current){b=Zi(a,b,c);break a}}else for(f=b.child,null!==f&&(f.return=b);null!==f;){var h=f.dependencies;if(null!==h){g=f.child;for(var k=h.firstContext;null!==k;){if(k.context===d){if(1===f.tag){k=mh(-1,c&-c);k.tag=2;var l=f.updateQueue;if(null!==l){l=l.shared;var m=l.pending;null===m?k.next=k:(k.next=m.next,m.next=k);l.pending=k;}}f.lanes|=c;k=f.alternate;null!==k&&(k.lanes|=c);bh(f.return,
	c,b);h.lanes|=c;break}k=k.next;}}else if(10===f.tag)g=f.type===b.type?null:f.child;else if(18===f.tag){g=f.return;if(null===g)throw Error(p$1(341));g.lanes|=c;h=g.alternate;null!==h&&(h.lanes|=c);bh(g,c,b);g=f.sibling;}else g=f.child;if(null!==g)g.return=f;else for(g=f;null!==g;){if(g===b){g=null;break}f=g.sibling;if(null!==f){f.return=g.return;g=f;break}g=g.return;}f=g;}Xi(a,b,e.children,c);b=b.child;}return b;case 9:return e=b.type,d=b.pendingProps.children,ch(b,c),e=eh(e),d=d(e),b.flags|=1,Xi(a,b,d,c),
	b.child;case 14:return d=b.type,e=Ci(d,b.pendingProps),e=Ci(d.type,e),$i(a,b,d,e,c);case 15:return bj(a,b,b.type,b.pendingProps,c);case 17:return d=b.type,e=b.pendingProps,e=b.elementType===d?e:Ci(d,e),ij(a,b),b.tag=1,Zf(d)?(a=!0,cg(b)):a=!1,ch(b,c),Gi(b,d,e),Ii(b,d,e,c),jj(null,b,d,!0,a,c);case 19:return xj(a,b,c);case 22:return dj(a,b,c)}throw Error(p$1(156,b.tag));};function Fk(a,b){return ac(a,b)}
	function $k(a,b,c,d){this.tag=a;this.key=c;this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null;this.index=0;this.ref=null;this.pendingProps=b;this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null;this.mode=d;this.subtreeFlags=this.flags=0;this.deletions=null;this.childLanes=this.lanes=0;this.alternate=null;}function Bg(a,b,c,d){return new $k(a,b,c,d)}function aj(a){a=a.prototype;return !(!a||!a.isReactComponent)}
	function Zk(a){if("function"===typeof a)return aj(a)?1:0;if(void 0!==a&&null!==a){a=a.$$typeof;if(a===Da)return 11;if(a===Ga)return 14}return 2}
	function Pg(a,b){var c=a.alternate;null===c?(c=Bg(a.tag,b,a.key,a.mode),c.elementType=a.elementType,c.type=a.type,c.stateNode=a.stateNode,c.alternate=a,a.alternate=c):(c.pendingProps=b,c.type=a.type,c.flags=0,c.subtreeFlags=0,c.deletions=null);c.flags=a.flags&14680064;c.childLanes=a.childLanes;c.lanes=a.lanes;c.child=a.child;c.memoizedProps=a.memoizedProps;c.memoizedState=a.memoizedState;c.updateQueue=a.updateQueue;b=a.dependencies;c.dependencies=null===b?null:{lanes:b.lanes,firstContext:b.firstContext};
	c.sibling=a.sibling;c.index=a.index;c.ref=a.ref;return c}
	function Rg(a,b,c,d,e,f){var g=2;d=a;if("function"===typeof a)aj(a)&&(g=1);else if("string"===typeof a)g=5;else a:switch(a){case ya:return Tg(c.children,e,f,b);case za:g=8;e|=8;break;case Aa:return a=Bg(12,c,b,e|2),a.elementType=Aa,a.lanes=f,a;case Ea:return a=Bg(13,c,b,e),a.elementType=Ea,a.lanes=f,a;case Fa:return a=Bg(19,c,b,e),a.elementType=Fa,a.lanes=f,a;case Ia:return pj(c,e,f,b);default:if("object"===typeof a&&null!==a)switch(a.$$typeof){case Ba:g=10;break a;case Ca:g=9;break a;case Da:g=11;
	break a;case Ga:g=14;break a;case Ha:g=16;d=null;break a}throw Error(p$1(130,null==a?a:typeof a,""));}b=Bg(g,c,b,e);b.elementType=a;b.type=d;b.lanes=f;return b}function Tg(a,b,c,d){a=Bg(7,a,d,b);a.lanes=c;return a}function pj(a,b,c,d){a=Bg(22,a,d,b);a.elementType=Ia;a.lanes=c;a.stateNode={isHidden:!1};return a}function Qg(a,b,c){a=Bg(6,a,null,b);a.lanes=c;return a}
	function Sg(a,b,c){b=Bg(4,null!==a.children?a.children:[],a.key,b);b.lanes=c;b.stateNode={containerInfo:a.containerInfo,pendingChildren:null,implementation:a.implementation};return b}
	function al(a,b,c,d,e){this.tag=b;this.containerInfo=a;this.finishedWork=this.pingCache=this.current=this.pendingChildren=null;this.timeoutHandle=-1;this.callbackNode=this.pendingContext=this.context=null;this.callbackPriority=0;this.eventTimes=zc(0);this.expirationTimes=zc(-1);this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0;this.entanglements=zc(0);this.identifierPrefix=d;this.onRecoverableError=e;this.mutableSourceEagerHydrationData=
	null;}function bl(a,b,c,d,e,f,g,h,k){a=new al(a,b,c,h,k);1===b?(b=1,!0===f&&(b|=8)):b=0;f=Bg(3,null,null,b);a.current=f;f.stateNode=a;f.memoizedState={element:d,isDehydrated:c,cache:null,transitions:null,pendingSuspenseBoundaries:null};kh(f);return a}function cl(a,b,c){var d=3<arguments.length&&void 0!==arguments[3]?arguments[3]:null;return {$$typeof:wa,key:null==d?null:""+d,children:a,containerInfo:b,implementation:c}}
	function dl(a){if(!a)return Vf;a=a._reactInternals;a:{if(Vb(a)!==a||1!==a.tag)throw Error(p$1(170));var b=a;do{switch(b.tag){case 3:b=b.stateNode.context;break a;case 1:if(Zf(b.type)){b=b.stateNode.__reactInternalMemoizedMergedChildContext;break a}}b=b.return;}while(null!==b);throw Error(p$1(171));}if(1===a.tag){var c=a.type;if(Zf(c))return bg(a,c,b)}return b}
	function el(a,b,c,d,e,f,g,h,k){a=bl(c,d,!0,a,e,f,g,h,k);a.context=dl(null);c=a.current;d=R();e=yi(c);f=mh(d,e);f.callback=void 0!==b&&null!==b?b:null;nh(c,f,e);a.current.lanes=e;Ac(a,e,d);Dk(a,d);return a}function fl(a,b,c,d){var e=b.current,f=R(),g=yi(e);c=dl(c);null===b.context?b.context=c:b.pendingContext=c;b=mh(f,g);b.payload={element:a};d=void 0===d?null:d;null!==d&&(b.callback=d);a=nh(e,b,g);null!==a&&(gi(a,e,g,f),oh(a,e,g));return g}
	function gl(a){a=a.current;if(!a.child)return null;switch(a.child.tag){case 5:return a.child.stateNode;default:return a.child.stateNode}}function hl(a,b){a=a.memoizedState;if(null!==a&&null!==a.dehydrated){var c=a.retryLane;a.retryLane=0!==c&&c<b?c:b;}}function il(a,b){hl(a,b);(a=a.alternate)&&hl(a,b);}function jl(){return null}var kl="function"===typeof reportError?reportError:function(a){console.error(a);};function ll(a){this._internalRoot=a;}
	ml.prototype.render=ll.prototype.render=function(a){var b=this._internalRoot;if(null===b)throw Error(p$1(409));fl(a,b,null,null);};ml.prototype.unmount=ll.prototype.unmount=function(){var a=this._internalRoot;if(null!==a){this._internalRoot=null;var b=a.containerInfo;Rk(function(){fl(null,a,null,null);});b[uf]=null;}};function ml(a){this._internalRoot=a;}
	ml.prototype.unstable_scheduleHydration=function(a){if(a){var b=Hc();a={blockedOn:null,target:a,priority:b};for(var c=0;c<Qc.length&&0!==b&&b<Qc[c].priority;c++);Qc.splice(c,0,a);0===c&&Vc(a);}};function nl(a){return !(!a||1!==a.nodeType&&9!==a.nodeType&&11!==a.nodeType)}function ol(a){return !(!a||1!==a.nodeType&&9!==a.nodeType&&11!==a.nodeType&&(8!==a.nodeType||" react-mount-point-unstable "!==a.nodeValue))}function pl(){}
	function ql(a,b,c,d,e){if(e){if("function"===typeof d){var f=d;d=function(){var a=gl(g);f.call(a);};}var g=el(b,d,a,0,null,!1,!1,"",pl);a._reactRootContainer=g;a[uf]=g.current;sf(8===a.nodeType?a.parentNode:a);Rk();return g}for(;e=a.lastChild;)a.removeChild(e);if("function"===typeof d){var h=d;d=function(){var a=gl(k);h.call(a);};}var k=bl(a,0,!1,null,null,!1,!1,"",pl);a._reactRootContainer=k;a[uf]=k.current;sf(8===a.nodeType?a.parentNode:a);Rk(function(){fl(b,k,c,d);});return k}
	function rl(a,b,c,d,e){var f=c._reactRootContainer;if(f){var g=f;if("function"===typeof e){var h=e;e=function(){var a=gl(g);h.call(a);};}fl(b,g,a,e);}else g=ql(c,b,a,e,d);return gl(g)}Ec=function(a){switch(a.tag){case 3:var b=a.stateNode;if(b.current.memoizedState.isDehydrated){var c=tc(b.pendingLanes);0!==c&&(Cc(b,c|1),Dk(b,B()),0===(K&6)&&(Gj=B()+500,jg()));}break;case 13:Rk(function(){var b=ih(a,1);if(null!==b){var c=R();gi(b,a,1,c);}}),il(a,1);}};
	Fc=function(a){if(13===a.tag){var b=ih(a,134217728);if(null!==b){var c=R();gi(b,a,134217728,c);}il(a,134217728);}};Gc=function(a){if(13===a.tag){var b=yi(a),c=ih(a,b);if(null!==c){var d=R();gi(c,a,b,d);}il(a,b);}};Hc=function(){return C};Ic=function(a,b){var c=C;try{return C=a,b()}finally{C=c;}};
	yb=function(a,b,c){switch(b){case "input":bb(a,c);b=c.name;if("radio"===c.type&&null!=b){for(c=a;c.parentNode;)c=c.parentNode;c=c.querySelectorAll("input[name="+JSON.stringify(""+b)+'][type="radio"]');for(b=0;b<c.length;b++){var d=c[b];if(d!==a&&d.form===a.form){var e=Db(d);if(!e)throw Error(p$1(90));Wa(d);bb(d,e);}}}break;case "textarea":ib(a,c);break;case "select":b=c.value,null!=b&&fb(a,!!c.multiple,b,!1);}};Gb=Qk;Hb=Rk;
	var sl={usingClientEntryPoint:!1,Events:[Cb,ue,Db,Eb,Fb,Qk]},tl={findFiberByHostInstance:Wc,bundleType:0,version:"18.3.1",rendererPackageName:"react-dom"};
	var ul={bundleType:tl.bundleType,version:tl.version,rendererPackageName:tl.rendererPackageName,rendererConfig:tl.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:ua.ReactCurrentDispatcher,findHostInstanceByFiber:function(a){a=Zb(a);return null===a?null:a.stateNode},findFiberByHostInstance:tl.findFiberByHostInstance||
	jl,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.3.1-next-f1338f8080-20240426"};if("undefined"!==typeof __REACT_DEVTOOLS_GLOBAL_HOOK__){var vl=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!vl.isDisabled&&vl.supportsFiber)try{kc=vl.inject(ul),lc=vl;}catch(a){}}reactDom_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=sl;
	reactDom_production_min.createPortal=function(a,b){var c=2<arguments.length&&void 0!==arguments[2]?arguments[2]:null;if(!nl(b))throw Error(p$1(200));return cl(a,b,null,c)};reactDom_production_min.createRoot=function(a,b){if(!nl(a))throw Error(p$1(299));var c=!1,d="",e=kl;null!==b&&void 0!==b&&(!0===b.unstable_strictMode&&(c=!0),void 0!==b.identifierPrefix&&(d=b.identifierPrefix),void 0!==b.onRecoverableError&&(e=b.onRecoverableError));b=bl(a,1,!1,null,null,c,!1,d,e);a[uf]=b.current;sf(8===a.nodeType?a.parentNode:a);return new ll(b)};
	reactDom_production_min.findDOMNode=function(a){if(null==a)return null;if(1===a.nodeType)return a;var b=a._reactInternals;if(void 0===b){if("function"===typeof a.render)throw Error(p$1(188));a=Object.keys(a).join(",");throw Error(p$1(268,a));}a=Zb(b);a=null===a?null:a.stateNode;return a};reactDom_production_min.flushSync=function(a){return Rk(a)};reactDom_production_min.hydrate=function(a,b,c){if(!ol(b))throw Error(p$1(200));return rl(null,a,b,!0,c)};
	reactDom_production_min.hydrateRoot=function(a,b,c){if(!nl(a))throw Error(p$1(405));var d=null!=c&&c.hydratedSources||null,e=!1,f="",g=kl;null!==c&&void 0!==c&&(!0===c.unstable_strictMode&&(e=!0),void 0!==c.identifierPrefix&&(f=c.identifierPrefix),void 0!==c.onRecoverableError&&(g=c.onRecoverableError));b=el(b,null,a,1,null!=c?c:null,e,!1,f,g);a[uf]=b.current;sf(a);if(d)for(a=0;a<d.length;a++)c=d[a],e=c._getVersion,e=e(c._source),null==b.mutableSourceEagerHydrationData?b.mutableSourceEagerHydrationData=[c,e]:b.mutableSourceEagerHydrationData.push(c,
	e);return new ml(b)};reactDom_production_min.render=function(a,b,c){if(!ol(b))throw Error(p$1(200));return rl(null,a,b,!1,c)};reactDom_production_min.unmountComponentAtNode=function(a){if(!ol(a))throw Error(p$1(40));return a._reactRootContainer?(Rk(function(){rl(null,null,a,!1,function(){a._reactRootContainer=null;a[uf]=null;});}),!0):!1};reactDom_production_min.unstable_batchedUpdates=Qk;
	reactDom_production_min.unstable_renderSubtreeIntoContainer=function(a,b,c,d){if(!ol(c))throw Error(p$1(200));if(null==a||void 0===a._reactInternals)throw Error(p$1(38));return rl(a,b,c,!1,d)};reactDom_production_min.version="18.3.1-next-f1338f8080-20240426";

	function checkDCE() {
	  /* global __REACT_DEVTOOLS_GLOBAL_HOOK__ */
	  if (
	    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined' ||
	    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== 'function'
	  ) {
	    return;
	  }
	  try {
	    // Verify that the code above has been dead code eliminated (DCE'd).
	    __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
	  } catch (err) {
	    // DevTools shouldn't crash React, no matter what.
	    // We should still report in case we break this code.
	    console.error(err);
	  }
	}

	{
	  // DCE check should happen before ReactDOM bundle executes so that
	  // DevTools can report bad minification during injection.
	  checkDCE();
	  reactDom.exports = reactDom_production_min;
	}

	var reactDomExports = reactDom.exports;

	var m$1 = reactDomExports;
	{
	  client.createRoot = m$1.createRoot;
	  client.hydrateRoot = m$1.hydrateRoot;
	}

	/**
	 * @remix-run/router v1.23.4
	 *
	 * Copyright (c) Remix Software Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE.md file in the root directory of this source tree.
	 *
	 * @license MIT
	 */
	function _extends$2() {
	  return _extends$2 = Object.assign ? Object.assign.bind() : function (n) {
	    for (var e = 1; e < arguments.length; e++) {
	      var t = arguments[e];
	      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
	    }
	    return n;
	  }, _extends$2.apply(null, arguments);
	}

	////////////////////////////////////////////////////////////////////////////////
	//#region Types and Constants
	////////////////////////////////////////////////////////////////////////////////
	/**
	 * Actions represent the type of change to a location value.
	 */
	var Action;
	(function (Action) {
	  /**
	   * A POP indicates a change to an arbitrary index in the history stack, such
	   * as a back or forward navigation. It does not describe the direction of the
	   * navigation, only that the current index changed.
	   *
	   * Note: This is the default action for newly created history objects.
	   */
	  Action["Pop"] = "POP";
	  /**
	   * A PUSH indicates a new entry being added to the history stack, such as when
	   * a link is clicked and a new page loads. When this happens, all subsequent
	   * entries in the stack are lost.
	   */
	  Action["Push"] = "PUSH";
	  /**
	   * A REPLACE indicates the entry at the current index in the history stack
	   * being replaced by a new one.
	   */
	  Action["Replace"] = "REPLACE";
	})(Action || (Action = {}));
	const PopStateEventType = "popstate";
	/**
	 * Browser history stores the location in regular URLs. This is the standard for
	 * most web apps, but it requires some configuration on the server to ensure you
	 * serve the same app at multiple URLs.
	 *
	 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#createbrowserhistory
	 */
	function createBrowserHistory(options) {
	  if (options === void 0) {
	    options = {};
	  }
	  function createBrowserLocation(window, globalHistory) {
	    let {
	      pathname,
	      search,
	      hash
	    } = window.location;
	    return createLocation("", {
	      pathname,
	      search,
	      hash
	    },
	    // state defaults to `null` because `window.history.state` does
	    globalHistory.state && globalHistory.state.usr || null, globalHistory.state && globalHistory.state.key || "default");
	  }
	  function createBrowserHref(window, to) {
	    return typeof to === "string" ? to : createPath(to);
	  }
	  return getUrlBasedHistory(createBrowserLocation, createBrowserHref, null, options);
	}
	function invariant(value, message) {
	  if (value === false || value === null || typeof value === "undefined") {
	    throw new Error(message);
	  }
	}
	function warning(cond, message) {
	  if (!cond) {
	    // eslint-disable-next-line no-console
	    if (typeof console !== "undefined") console.warn(message);
	    try {
	      // Welcome to debugging history!
	      //
	      // This error is thrown as a convenience, so you can more easily
	      // find the source for a warning that appears in the console by
	      // enabling "pause on exceptions" in your JavaScript debugger.
	      throw new Error(message);
	      // eslint-disable-next-line no-empty
	    } catch (e) {}
	  }
	}
	function createKey() {
	  return Math.random().toString(36).substr(2, 8);
	}
	/**
	 * For browser-based histories, we combine the state and key into an object
	 */
	function getHistoryState(location, index) {
	  return {
	    usr: location.state,
	    key: location.key,
	    idx: index
	  };
	}
	/**
	 * Creates a Location object with a unique key from the given Path
	 */
	function createLocation(current, to, state, key) {
	  if (state === void 0) {
	    state = null;
	  }
	  let location = _extends$2({
	    pathname: typeof current === "string" ? current : current.pathname,
	    search: "",
	    hash: ""
	  }, typeof to === "string" ? parsePath(to) : to, {
	    state,
	    // TODO: This could be cleaned up.  push/replace should probably just take
	    // full Locations now and avoid the need to run through this flow at all
	    // But that's a pretty big refactor to the current test suite so going to
	    // keep as is for the time being and just let any incoming keys take precedence
	    key: to && to.key || key || createKey()
	  });
	  return location;
	}
	/**
	 * Creates a string URL path from the given pathname, search, and hash components.
	 */
	function createPath(_ref) {
	  let {
	    pathname = "/",
	    search = "",
	    hash = ""
	  } = _ref;
	  if (search && search !== "?") pathname += search.charAt(0) === "?" ? search : "?" + search;
	  if (hash && hash !== "#") pathname += hash.charAt(0) === "#" ? hash : "#" + hash;
	  return pathname;
	}
	/**
	 * Parses a string URL path into its separate pathname, search, and hash components.
	 */
	function parsePath(path) {
	  let parsedPath = {};
	  if (path) {
	    let hashIndex = path.indexOf("#");
	    if (hashIndex >= 0) {
	      parsedPath.hash = path.substr(hashIndex);
	      path = path.substr(0, hashIndex);
	    }
	    let searchIndex = path.indexOf("?");
	    if (searchIndex >= 0) {
	      parsedPath.search = path.substr(searchIndex);
	      path = path.substr(0, searchIndex);
	    }
	    if (path) {
	      parsedPath.pathname = path;
	    }
	  }
	  return parsedPath;
	}
	function getUrlBasedHistory(getLocation, createHref, validateLocation, options) {
	  if (options === void 0) {
	    options = {};
	  }
	  let {
	    window = document.defaultView,
	    v5Compat = false
	  } = options;
	  let globalHistory = window.history;
	  let action = Action.Pop;
	  let listener = null;
	  let index = getIndex();
	  // Index should only be null when we initialize. If not, it's because the
	  // user called history.pushState or history.replaceState directly, in which
	  // case we should log a warning as it will result in bugs.
	  if (index == null) {
	    index = 0;
	    globalHistory.replaceState(_extends$2({}, globalHistory.state, {
	      idx: index
	    }), "");
	  }
	  function getIndex() {
	    let state = globalHistory.state || {
	      idx: null
	    };
	    return state.idx;
	  }
	  function handlePop() {
	    action = Action.Pop;
	    let nextIndex = getIndex();
	    let delta = nextIndex == null ? null : nextIndex - index;
	    index = nextIndex;
	    if (listener) {
	      listener({
	        action,
	        location: history.location,
	        delta
	      });
	    }
	  }
	  function push(to, state) {
	    action = Action.Push;
	    let location = createLocation(history.location, to, state);
	    if (validateLocation) validateLocation(location, to);
	    index = getIndex() + 1;
	    let historyState = getHistoryState(location, index);
	    let url = history.createHref(location);
	    // try...catch because iOS limits us to 100 pushState calls :/
	    try {
	      globalHistory.pushState(historyState, "", url);
	    } catch (error) {
	      // If the exception is because `state` can't be serialized, let that throw
	      // outwards just like a replace call would so the dev knows the cause
	      // https://html.spec.whatwg.org/multipage/nav-history-apis.html#shared-history-push/replace-state-steps
	      // https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializeinternal
	      if (error instanceof DOMException && error.name === "DataCloneError") {
	        throw error;
	      }
	      // They are going to lose state here, but there is no real
	      // way to warn them about it since the page will refresh...
	      window.location.assign(url);
	    }
	    if (v5Compat && listener) {
	      listener({
	        action,
	        location: history.location,
	        delta: 1
	      });
	    }
	  }
	  function replace(to, state) {
	    action = Action.Replace;
	    let location = createLocation(history.location, to, state);
	    if (validateLocation) validateLocation(location, to);
	    index = getIndex();
	    let historyState = getHistoryState(location, index);
	    let url = history.createHref(location);
	    globalHistory.replaceState(historyState, "", url);
	    if (v5Compat && listener) {
	      listener({
	        action,
	        location: history.location,
	        delta: 0
	      });
	    }
	  }
	  function createURL(to) {
	    // window.location.origin is "null" (the literal string value) in Firefox
	    // under certain conditions, notably when serving from a local HTML file
	    // See https://bugzilla.mozilla.org/show_bug.cgi?id=878297
	    let base = window.location.origin !== "null" ? window.location.origin : window.location.href;
	    let href = typeof to === "string" ? to : createPath(to);
	    // Treating this as a full URL will strip any trailing spaces so we need to
	    // pre-encode them since they might be part of a matching splat param from
	    // an ancestor route
	    href = href.replace(/ $/, "%20");
	    invariant(base, "No window.location.(origin|href) available to create URL for href: " + href);
	    return new URL(href, base);
	  }
	  let history = {
	    get action() {
	      return action;
	    },
	    get location() {
	      return getLocation(window, globalHistory);
	    },
	    listen(fn) {
	      if (listener) {
	        throw new Error("A history only accepts one active listener");
	      }
	      window.addEventListener(PopStateEventType, handlePop);
	      listener = fn;
	      return () => {
	        window.removeEventListener(PopStateEventType, handlePop);
	        listener = null;
	      };
	    },
	    createHref(to) {
	      return createHref(window, to);
	    },
	    createURL,
	    encodeLocation(to) {
	      // Encode a Location the same way window.location would
	      let url = createURL(to);
	      return {
	        pathname: url.pathname,
	        search: url.search,
	        hash: url.hash
	      };
	    },
	    push,
	    replace,
	    go(n) {
	      return globalHistory.go(n);
	    }
	  };
	  return history;
	}
	//#endregion

	var ResultType;
	(function (ResultType) {
	  ResultType["data"] = "data";
	  ResultType["deferred"] = "deferred";
	  ResultType["redirect"] = "redirect";
	  ResultType["error"] = "error";
	})(ResultType || (ResultType = {}));
	/**
	 * Matches the given routes to a location and returns the match data.
	 *
	 * @see https://reactrouter.com/v6/utils/match-routes
	 */
	function matchRoutes(routes, locationArg, basename) {
	  if (basename === void 0) {
	    basename = "/";
	  }
	  return matchRoutesImpl(routes, locationArg, basename, false);
	}
	function matchRoutesImpl(routes, locationArg, basename, allowPartial) {
	  let location = typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
	  let pathname = stripBasename(location.pathname || "/", basename);
	  if (pathname == null) {
	    return null;
	  }
	  let branches = flattenRoutes(routes);
	  rankRouteBranches(branches);
	  let matches = null;
	  let decoded = decodePath(pathname);
	  for (let i = 0; matches == null && i < branches.length; ++i) {
	    // Incoming pathnames are generally encoded from either window.location
	    // or from router.navigate, but we want to match against the unencoded
	    // paths in the route definitions.  Memory router locations won't be
	    // encoded here but there also shouldn't be anything to decode so this
	    // should be a safe operation.  This avoids needing matchRoutes to be
	    // history-aware.
	    matches = matchRouteBranch(branches[i], decoded, allowPartial);
	  }
	  return matches;
	}
	function flattenRoutes(routes, branches, parentsMeta, parentPath) {
	  if (branches === void 0) {
	    branches = [];
	  }
	  if (parentsMeta === void 0) {
	    parentsMeta = [];
	  }
	  if (parentPath === void 0) {
	    parentPath = "";
	  }
	  let flattenRoute = (route, index, relativePath) => {
	    let meta = {
	      relativePath: relativePath === undefined ? route.path || "" : relativePath,
	      caseSensitive: route.caseSensitive === true,
	      childrenIndex: index,
	      route
	    };
	    if (meta.relativePath.startsWith("/")) {
	      invariant(meta.relativePath.startsWith(parentPath), "Absolute route path \"" + meta.relativePath + "\" nested under path " + ("\"" + parentPath + "\" is not valid. An absolute child route path ") + "must start with the combined path of all its parent routes.");
	      meta.relativePath = meta.relativePath.slice(parentPath.length);
	    }
	    let path = joinPaths([parentPath, meta.relativePath]);
	    let routesMeta = parentsMeta.concat(meta);
	    // Add the children before adding this route to the array, so we traverse the
	    // route tree depth-first and child routes appear before their parents in
	    // the "flattened" version.
	    if (route.children && route.children.length > 0) {
	      invariant(
	      // Our types know better, but runtime JS may not!
	      // @ts-expect-error
	      route.index !== true, "Index routes must not have child routes. Please remove " + ("all child routes from route path \"" + path + "\"."));
	      flattenRoutes(route.children, branches, routesMeta, path);
	    }
	    // Routes without a path shouldn't ever match by themselves unless they are
	    // index routes, so don't add them to the list of possible branches.
	    if (route.path == null && !route.index) {
	      return;
	    }
	    branches.push({
	      path,
	      score: computeScore(path, route.index),
	      routesMeta
	    });
	  };
	  routes.forEach((route, index) => {
	    var _route$path;
	    // coarse-grain check for optional params
	    if (route.path === "" || !((_route$path = route.path) != null && _route$path.includes("?"))) {
	      flattenRoute(route, index);
	    } else {
	      for (let exploded of explodeOptionalSegments(route.path)) {
	        flattenRoute(route, index, exploded);
	      }
	    }
	  });
	  return branches;
	}
	/**
	 * Computes all combinations of optional path segments for a given path,
	 * excluding combinations that are ambiguous and of lower priority.
	 *
	 * For example, `/one/:two?/three/:four?/:five?` explodes to:
	 * - `/one/three`
	 * - `/one/:two/three`
	 * - `/one/three/:four`
	 * - `/one/three/:five`
	 * - `/one/:two/three/:four`
	 * - `/one/:two/three/:five`
	 * - `/one/three/:four/:five`
	 * - `/one/:two/three/:four/:five`
	 */
	function explodeOptionalSegments(path) {
	  let segments = path.split("/");
	  if (segments.length === 0) return [];
	  let [first, ...rest] = segments;
	  // Optional path segments are denoted by a trailing `?`
	  let isOptional = first.endsWith("?");
	  // Compute the corresponding required segment: `foo?` -> `foo`
	  let required = first.replace(/\?$/, "");
	  if (rest.length === 0) {
	    // Intepret empty string as omitting an optional segment
	    // `["one", "", "three"]` corresponds to omitting `:two` from `/one/:two?/three` -> `/one/three`
	    return isOptional ? [required, ""] : [required];
	  }
	  let restExploded = explodeOptionalSegments(rest.join("/"));
	  let result = [];
	  // All child paths with the prefix.  Do this for all children before the
	  // optional version for all children, so we get consistent ordering where the
	  // parent optional aspect is preferred as required.  Otherwise, we can get
	  // child sections interspersed where deeper optional segments are higher than
	  // parent optional segments, where for example, /:two would explode _earlier_
	  // then /:one.  By always including the parent as required _for all children_
	  // first, we avoid this issue
	  result.push(...restExploded.map(subpath => subpath === "" ? required : [required, subpath].join("/")));
	  // Then, if this is an optional value, add all child versions without
	  if (isOptional) {
	    result.push(...restExploded);
	  }
	  // for absolute paths, ensure `/` instead of empty segment
	  return result.map(exploded => path.startsWith("/") && exploded === "" ? "/" : exploded);
	}
	function rankRouteBranches(branches) {
	  branches.sort((a, b) => a.score !== b.score ? b.score - a.score // Higher score first
	  : compareIndexes(a.routesMeta.map(meta => meta.childrenIndex), b.routesMeta.map(meta => meta.childrenIndex)));
	}
	const paramRe = /^:[\w-]+$/;
	const dynamicSegmentValue = 3;
	const indexRouteValue = 2;
	const emptySegmentValue = 1;
	const staticSegmentValue = 10;
	const splatPenalty = -2;
	const isSplat = s => s === "*";
	function computeScore(path, index) {
	  let segments = path.split("/");
	  let initialScore = segments.length;
	  if (segments.some(isSplat)) {
	    initialScore += splatPenalty;
	  }
	  if (index) {
	    initialScore += indexRouteValue;
	  }
	  return segments.filter(s => !isSplat(s)).reduce((score, segment) => score + (paramRe.test(segment) ? dynamicSegmentValue : segment === "" ? emptySegmentValue : staticSegmentValue), initialScore);
	}
	function compareIndexes(a, b) {
	  let siblings = a.length === b.length && a.slice(0, -1).every((n, i) => n === b[i]);
	  return siblings ?
	  // If two routes are siblings, we should try to match the earlier sibling
	  // first. This allows people to have fine-grained control over the matching
	  // behavior by simply putting routes with identical paths in the order they
	  // want them tried.
	  a[a.length - 1] - b[b.length - 1] :
	  // Otherwise, it doesn't really make sense to rank non-siblings by index,
	  // so they sort equally.
	  0;
	}
	function matchRouteBranch(branch, pathname, allowPartial) {
	  if (allowPartial === void 0) {
	    allowPartial = false;
	  }
	  let {
	    routesMeta
	  } = branch;
	  let matchedParams = {};
	  let matchedPathname = "/";
	  let matches = [];
	  for (let i = 0; i < routesMeta.length; ++i) {
	    let meta = routesMeta[i];
	    let end = i === routesMeta.length - 1;
	    let remainingPathname = matchedPathname === "/" ? pathname : pathname.slice(matchedPathname.length) || "/";
	    let match = matchPath({
	      path: meta.relativePath,
	      caseSensitive: meta.caseSensitive,
	      end
	    }, remainingPathname);
	    let route = meta.route;
	    if (!match && end && allowPartial && !routesMeta[routesMeta.length - 1].route.index) {
	      match = matchPath({
	        path: meta.relativePath,
	        caseSensitive: meta.caseSensitive,
	        end: false
	      }, remainingPathname);
	    }
	    if (!match) {
	      return null;
	    }
	    Object.assign(matchedParams, match.params);
	    matches.push({
	      // TODO: Can this as be avoided?
	      params: matchedParams,
	      pathname: joinPaths([matchedPathname, match.pathname]),
	      pathnameBase: normalizePathname(joinPaths([matchedPathname, match.pathnameBase])),
	      route
	    });
	    if (match.pathnameBase !== "/") {
	      matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
	    }
	  }
	  return matches;
	}
	/**
	 * Performs pattern matching on a URL pathname and returns information about
	 * the match.
	 *
	 * @see https://reactrouter.com/v6/utils/match-path
	 */
	function matchPath(pattern, pathname) {
	  if (typeof pattern === "string") {
	    pattern = {
	      path: pattern,
	      caseSensitive: false,
	      end: true
	    };
	  }
	  let [matcher, compiledParams] = compilePath(pattern.path, pattern.caseSensitive, pattern.end);
	  let match = pathname.match(matcher);
	  if (!match) return null;
	  let matchedPathname = match[0];
	  let pathnameBase = matchedPathname.replace(/(.)\/+$/, "$1");
	  let captureGroups = match.slice(1);
	  let params = compiledParams.reduce((memo, _ref, index) => {
	    let {
	      paramName,
	      isOptional
	    } = _ref;
	    // We need to compute the pathnameBase here using the raw splat value
	    // instead of using params["*"] later because it will be decoded then
	    if (paramName === "*") {
	      let splatValue = captureGroups[index] || "";
	      pathnameBase = matchedPathname.slice(0, matchedPathname.length - splatValue.length).replace(/(.)\/+$/, "$1");
	    }
	    const value = captureGroups[index];
	    if (isOptional && !value) {
	      memo[paramName] = undefined;
	    } else {
	      memo[paramName] = (value || "").replace(/%2F/g, "/");
	    }
	    return memo;
	  }, {});
	  return {
	    params,
	    pathname: matchedPathname,
	    pathnameBase,
	    pattern
	  };
	}
	function compilePath(path, caseSensitive, end) {
	  if (caseSensitive === void 0) {
	    caseSensitive = false;
	  }
	  if (end === void 0) {
	    end = true;
	  }
	  warning(path === "*" || !path.endsWith("*") || path.endsWith("/*"), "Route path \"" + path + "\" will be treated as if it were " + ("\"" + path.replace(/\*$/, "/*") + "\" because the `*` character must ") + "always follow a `/` in the pattern. To get rid of this warning, " + ("please change the route path to \"" + path.replace(/\*$/, "/*") + "\"."));
	  let params = [];
	  let regexpSource = "^" + path.replace(/\/*\*?$/, "") // Ignore trailing / and /*, we'll handle it below
	  .replace(/^\/*/, "/") // Make sure it has a leading /
	  .replace(/[\\.*+^${}|()[\]]/g, "\\$&") // Escape special regex chars
	  .replace(/\/:([\w-]+)(\?)?/g, (_, paramName, isOptional) => {
	    params.push({
	      paramName,
	      isOptional: isOptional != null
	    });
	    return isOptional ? "/?([^\\/]+)?" : "/([^\\/]+)";
	  });
	  if (path.endsWith("*")) {
	    params.push({
	      paramName: "*"
	    });
	    regexpSource += path === "*" || path === "/*" ? "(.*)$" // Already matched the initial /, just match the rest
	    : "(?:\\/(.+)|\\/*)$"; // Don't include the / in params["*"]
	  } else if (end) {
	    // When matching to the end, ignore trailing slashes
	    regexpSource += "\\/*$";
	  } else if (path !== "" && path !== "/") {
	    // If our path is non-empty and contains anything beyond an initial slash,
	    // then we have _some_ form of path in our regex, so we should expect to
	    // match only if we find the end of this path segment.  Look for an optional
	    // non-captured trailing slash (to match a portion of the URL) or the end
	    // of the path (if we've matched to the end).  We used to do this with a
	    // word boundary but that gives false positives on routes like
	    // /user-preferences since `-` counts as a word boundary.
	    regexpSource += "(?:(?=\\/|$))";
	  } else ;
	  let matcher = new RegExp(regexpSource, caseSensitive ? undefined : "i");
	  return [matcher, params];
	}
	function decodePath(value) {
	  try {
	    return value.split("/").map(v => decodeURIComponent(v).replace(/\//g, "%2F")).join("/");
	  } catch (error) {
	    warning(false, "The URL path \"" + value + "\" could not be decoded because it is is a " + "malformed URL segment. This is probably due to a bad percent " + ("encoding (" + error + ")."));
	    return value;
	  }
	}
	/**
	 * @private
	 */
	function stripBasename(pathname, basename) {
	  if (basename === "/") return pathname;
	  if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
	    return null;
	  }
	  // We want to leave trailing slash behavior in the user's control, so if they
	  // specify a basename with a trailing slash, we should support it
	  let startIndex = basename.endsWith("/") ? basename.length - 1 : basename.length;
	  let nextChar = pathname.charAt(startIndex);
	  if (nextChar && nextChar !== "/") {
	    // pathname does not start with basename/
	    return null;
	  }
	  return pathname.slice(startIndex) || "/";
	}
	/**
	 * Returns a resolved path object relative to the given pathname.
	 *
	 * @see https://reactrouter.com/v6/utils/resolve-path
	 */
	function resolvePath(to, fromPathname) {
	  if (fromPathname === void 0) {
	    fromPathname = "/";
	  }
	  let {
	    pathname: toPathname,
	    search = "",
	    hash = ""
	  } = typeof to === "string" ? parsePath(to) : to;
	  let pathname;
	  if (toPathname) {
	    toPathname = removeDoubleSlashes(toPathname);
	    if (toPathname.startsWith("/")) {
	      pathname = resolvePathname(toPathname.substring(1), "/");
	    } else {
	      pathname = resolvePathname(toPathname, fromPathname);
	    }
	  } else {
	    pathname = fromPathname;
	  }
	  return {
	    pathname,
	    search: normalizeSearch(search),
	    hash: normalizeHash(hash)
	  };
	}
	function resolvePathname(relativePath, fromPathname) {
	  let segments = fromPathname.replace(/\/+$/, "").split("/");
	  let relativeSegments = relativePath.split("/");
	  relativeSegments.forEach(segment => {
	    if (segment === "..") {
	      // Keep the root "" segment so the pathname starts at /
	      if (segments.length > 1) segments.pop();
	    } else if (segment !== ".") {
	      segments.push(segment);
	    }
	  });
	  return segments.length > 1 ? segments.join("/") : "/";
	}
	function getInvalidPathError(char, field, dest, path) {
	  return "Cannot include a '" + char + "' character in a manually specified " + ("`to." + field + "` field [" + JSON.stringify(path) + "].  Please separate it out to the ") + ("`to." + dest + "` field. Alternatively you may provide the full path as ") + "a string in <Link to=\"...\"> and the router will parse it for you.";
	}
	/**
	 * @private
	 *
	 * When processing relative navigation we want to ignore ancestor routes that
	 * do not contribute to the path, such that index/pathless layout routes don't
	 * interfere.
	 *
	 * For example, when moving a route element into an index route and/or a
	 * pathless layout route, relative link behavior contained within should stay
	 * the same.  Both of the following examples should link back to the root:
	 *
	 *   <Route path="/">
	 *     <Route path="accounts" element={<Link to=".."}>
	 *   </Route>
	 *
	 *   <Route path="/">
	 *     <Route path="accounts">
	 *       <Route element={<AccountsLayout />}>       // <-- Does not contribute
	 *         <Route index element={<Link to=".."} />  // <-- Does not contribute
	 *       </Route
	 *     </Route>
	 *   </Route>
	 */
	function getPathContributingMatches(matches) {
	  return matches.filter((match, index) => index === 0 || match.route.path && match.route.path.length > 0);
	}
	// Return the array of pathnames for the current route matches - used to
	// generate the routePathnames input for resolveTo()
	function getResolveToMatches(matches, v7_relativeSplatPath) {
	  let pathMatches = getPathContributingMatches(matches);
	  // When v7_relativeSplatPath is enabled, use the full pathname for the leaf
	  // match so we include splat values for "." links.  See:
	  // https://github.com/remix-run/react-router/issues/11052#issuecomment-1836589329
	  if (v7_relativeSplatPath) {
	    return pathMatches.map((match, idx) => idx === pathMatches.length - 1 ? match.pathname : match.pathnameBase);
	  }
	  return pathMatches.map(match => match.pathnameBase);
	}
	/**
	 * @private
	 */
	function resolveTo(toArg, routePathnames, locationPathname, isPathRelative) {
	  if (isPathRelative === void 0) {
	    isPathRelative = false;
	  }
	  let to;
	  if (typeof toArg === "string") {
	    to = parsePath(toArg);
	  } else {
	    to = _extends$2({}, toArg);
	    invariant(!to.pathname || !to.pathname.includes("?"), getInvalidPathError("?", "pathname", "search", to));
	    invariant(!to.pathname || !to.pathname.includes("#"), getInvalidPathError("#", "pathname", "hash", to));
	    invariant(!to.search || !to.search.includes("#"), getInvalidPathError("#", "search", "hash", to));
	  }
	  let isEmptyPath = toArg === "" || to.pathname === "";
	  let toPathname = isEmptyPath ? "/" : to.pathname;
	  let from;
	  // Routing is relative to the current pathname if explicitly requested.
	  //
	  // If a pathname is explicitly provided in `to`, it should be relative to the
	  // route context. This is explained in `Note on `<Link to>` values` in our
	  // migration guide from v5 as a means of disambiguation between `to` values
	  // that begin with `/` and those that do not. However, this is problematic for
	  // `to` values that do not provide a pathname. `to` can simply be a search or
	  // hash string, in which case we should assume that the navigation is relative
	  // to the current location's pathname and *not* the route pathname.
	  if (toPathname == null) {
	    from = locationPathname;
	  } else {
	    let routePathnameIndex = routePathnames.length - 1;
	    // With relative="route" (the default), each leading .. segment means
	    // "go up one route" instead of "go up one URL segment".  This is a key
	    // difference from how <a href> works and a major reason we call this a
	    // "to" value instead of a "href".
	    if (!isPathRelative && toPathname.startsWith("..")) {
	      let toSegments = toPathname.split("/");
	      while (toSegments[0] === "..") {
	        toSegments.shift();
	        routePathnameIndex -= 1;
	      }
	      to.pathname = toSegments.join("/");
	    }
	    from = routePathnameIndex >= 0 ? routePathnames[routePathnameIndex] : "/";
	  }
	  let path = resolvePath(to, from);
	  // Ensure the pathname has a trailing slash if the original "to" had one
	  let hasExplicitTrailingSlash = toPathname && toPathname !== "/" && toPathname.endsWith("/");
	  // Or if this was a link to the current path which has a trailing slash
	  let hasCurrentTrailingSlash = (isEmptyPath || toPathname === ".") && locationPathname.endsWith("/");
	  if (!path.pathname.endsWith("/") && (hasExplicitTrailingSlash || hasCurrentTrailingSlash)) {
	    path.pathname += "/";
	  }
	  return path;
	}
	const removeDoubleSlashes = path => path.replace(/\/\/+/g, "/");
	/**
	 * @private
	 */
	const joinPaths = paths => removeDoubleSlashes(paths.join("/"));
	/**
	 * @private
	 */
	const normalizePathname = pathname => pathname.replace(/\/+$/, "").replace(/^\/*/, "/");
	/**
	 * @private
	 */
	const normalizeSearch = search => !search || search === "?" ? "" : search.startsWith("?") ? search : "?" + search;
	/**
	 * @private
	 */
	const normalizeHash = hash => !hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash;
	/**
	 * Check if the given error is an ErrorResponse generated from a 4xx/5xx
	 * Response thrown from an action/loader
	 */
	function isRouteErrorResponse(error) {
	  return error != null && typeof error.status === "number" && typeof error.statusText === "string" && typeof error.internal === "boolean" && "data" in error;
	}

	const validMutationMethodsArr = ["post", "put", "patch", "delete"];
	new Set(validMutationMethodsArr);
	const validRequestMethodsArr = ["get", ...validMutationMethodsArr];
	new Set(validRequestMethodsArr);

	/**
	 * React Router v6.30.6
	 *
	 * Copyright (c) Remix Software Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE.md file in the root directory of this source tree.
	 *
	 * @license MIT
	 */

	function _extends$1() {
	  return _extends$1 = Object.assign ? Object.assign.bind() : function (n) {
	    for (var e = 1; e < arguments.length; e++) {
	      var t = arguments[e];
	      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
	    }
	    return n;
	  }, _extends$1.apply(null, arguments);
	}

	// Create react-specific types from the agnostic types in @remix-run/router to
	// export from react-router

	const DataRouterContext = /*#__PURE__*/reactExports.createContext(null);
	const DataRouterStateContext = /*#__PURE__*/reactExports.createContext(null);

	/**
	 * A Navigator is a "location changer"; it's how you get to different locations.
	 *
	 * Every history instance conforms to the Navigator interface, but the
	 * distinction is useful primarily when it comes to the low-level `<Router>` API
	 * where both the location and a navigator must be provided separately in order
	 * to avoid "tearing" that may occur in a suspense-enabled app if the action
	 * and/or location were to be read directly from the history instance.
	 */

	const NavigationContext = /*#__PURE__*/reactExports.createContext(null);
	const LocationContext = /*#__PURE__*/reactExports.createContext(null);
	const RouteContext = /*#__PURE__*/reactExports.createContext({
	  outlet: null,
	  matches: [],
	  isDataRoute: false
	});
	const RouteErrorContext = /*#__PURE__*/reactExports.createContext(null);

	/**
	 * Returns the full href for the given "to" value. This is useful for building
	 * custom links that are also accessible and preserve right-click behavior.
	 *
	 * @see https://reactrouter.com/v6/hooks/use-href
	 */
	function useHref(to, _temp) {
	  let {
	    relative
	  } = _temp === void 0 ? {} : _temp;
	  !useInRouterContext() ? invariant(false) : void 0;
	  let {
	    basename,
	    navigator
	  } = reactExports.useContext(NavigationContext);
	  let {
	    hash,
	    pathname,
	    search
	  } = useResolvedPath(to, {
	    relative
	  });
	  let joinedPathname = pathname;

	  // If we're operating within a basename, prepend it to the pathname prior
	  // to creating the href.  If this is a root navigation, then just use the raw
	  // basename which allows the basename to have full control over the presence
	  // of a trailing slash on root links
	  if (basename !== "/") {
	    joinedPathname = pathname === "/" ? basename : joinPaths([basename, pathname]);
	  }
	  return navigator.createHref({
	    pathname: joinedPathname,
	    search,
	    hash
	  });
	}

	/**
	 * Returns true if this component is a descendant of a `<Router>`.
	 *
	 * @see https://reactrouter.com/v6/hooks/use-in-router-context
	 */
	function useInRouterContext() {
	  return reactExports.useContext(LocationContext) != null;
	}

	/**
	 * Returns the current location object, which represents the current URL in web
	 * browsers.
	 *
	 * Note: If you're using this it may mean you're doing some of your own
	 * "routing" in your app, and we'd like to know what your use case is. We may
	 * be able to provide something higher-level to better suit your needs.
	 *
	 * @see https://reactrouter.com/v6/hooks/use-location
	 */
	function useLocation() {
	  !useInRouterContext() ? invariant(false) : void 0;
	  return reactExports.useContext(LocationContext).location;
	}

	// Mute warnings for calls to useNavigate in SSR environments
	function useIsomorphicLayoutEffect(cb) {
	  let isStatic = reactExports.useContext(NavigationContext).static;
	  if (!isStatic) {
	    // We should be able to get rid of this once react 18.3 is released
	    // See: https://github.com/facebook/react/pull/26395
	    // eslint-disable-next-line react-hooks/rules-of-hooks
	    reactExports.useLayoutEffect(cb);
	  }
	}

	/**
	 * Returns an imperative method for changing the location. Used by `<Link>`s, but
	 * may also be used by other elements to change the location.
	 *
	 * @see https://reactrouter.com/v6/hooks/use-navigate
	 */
	function useNavigate() {
	  let {
	    isDataRoute
	  } = reactExports.useContext(RouteContext);
	  // Conditional usage is OK here because the usage of a data router is static
	  // eslint-disable-next-line react-hooks/rules-of-hooks
	  return isDataRoute ? useNavigateStable() : useNavigateUnstable();
	}
	function useNavigateUnstable() {
	  !useInRouterContext() ? invariant(false) : void 0;
	  let dataRouterContext = reactExports.useContext(DataRouterContext);
	  let {
	    basename,
	    future,
	    navigator
	  } = reactExports.useContext(NavigationContext);
	  let {
	    matches
	  } = reactExports.useContext(RouteContext);
	  let {
	    pathname: locationPathname
	  } = useLocation();
	  let routePathnamesJson = JSON.stringify(getResolveToMatches(matches, future.v7_relativeSplatPath));
	  let activeRef = reactExports.useRef(false);
	  useIsomorphicLayoutEffect(() => {
	    activeRef.current = true;
	  });
	  let navigate = reactExports.useCallback(function (to, options) {
	    if (options === void 0) {
	      options = {};
	    }

	    // Short circuit here since if this happens on first render the navigate
	    // is useless because we haven't wired up our history listener yet
	    if (!activeRef.current) return;
	    if (typeof to === "number") {
	      navigator.go(to);
	      return;
	    }
	    let path = resolveTo(to, JSON.parse(routePathnamesJson), locationPathname, options.relative === "path");

	    // If we're operating within a basename, prepend it to the pathname prior
	    // to handing off to history (but only if we're not in a data router,
	    // otherwise it'll prepend the basename inside of the router).
	    // If this is a root navigation, then we navigate to the raw basename
	    // which allows the basename to have full control over the presence of a
	    // trailing slash on root links
	    if (dataRouterContext == null && basename !== "/") {
	      path.pathname = path.pathname === "/" ? basename : joinPaths([basename, path.pathname]);
	    }
	    (!!options.replace ? navigator.replace : navigator.push)(path, options.state, options);
	  }, [basename, navigator, routePathnamesJson, locationPathname, dataRouterContext]);
	  return navigate;
	}
	const OutletContext = /*#__PURE__*/reactExports.createContext(null);

	/**
	 * Returns the element for the child route at this level of the route
	 * hierarchy. Used internally by `<Outlet>` to render child routes.
	 *
	 * @see https://reactrouter.com/v6/hooks/use-outlet
	 */
	function useOutlet(context) {
	  let outlet = reactExports.useContext(RouteContext).outlet;
	  if (outlet) {
	    return /*#__PURE__*/reactExports.createElement(OutletContext.Provider, {
	      value: context
	    }, outlet);
	  }
	  return outlet;
	}

	/**
	 * Returns an object of key/value pairs of the dynamic params from the current
	 * URL that were matched by the route path.
	 *
	 * @see https://reactrouter.com/v6/hooks/use-params
	 */
	function useParams() {
	  let {
	    matches
	  } = reactExports.useContext(RouteContext);
	  let routeMatch = matches[matches.length - 1];
	  return routeMatch ? routeMatch.params : {};
	}

	/**
	 * Resolves the pathname of the given `to` value against the current location.
	 *
	 * @see https://reactrouter.com/v6/hooks/use-resolved-path
	 */
	function useResolvedPath(to, _temp2) {
	  let {
	    relative
	  } = _temp2 === void 0 ? {} : _temp2;
	  let {
	    future
	  } = reactExports.useContext(NavigationContext);
	  let {
	    matches
	  } = reactExports.useContext(RouteContext);
	  let {
	    pathname: locationPathname
	  } = useLocation();
	  let routePathnamesJson = JSON.stringify(getResolveToMatches(matches, future.v7_relativeSplatPath));
	  return reactExports.useMemo(() => resolveTo(to, JSON.parse(routePathnamesJson), locationPathname, relative === "path"), [to, routePathnamesJson, locationPathname, relative]);
	}

	/**
	 * Returns the element of the route that matched the current location, prepared
	 * with the correct context to render the remainder of the route tree. Route
	 * elements in the tree must render an `<Outlet>` to render their child route's
	 * element.
	 *
	 * @see https://reactrouter.com/v6/hooks/use-routes
	 */
	function useRoutes(routes, locationArg) {
	  return useRoutesImpl(routes, locationArg);
	}

	// Internal implementation with accept optional param for RouterProvider usage
	function useRoutesImpl(routes, locationArg, dataRouterState, future) {
	  !useInRouterContext() ? invariant(false) : void 0;
	  let {
	    navigator
	  } = reactExports.useContext(NavigationContext);
	  let {
	    matches: parentMatches
	  } = reactExports.useContext(RouteContext);
	  let routeMatch = parentMatches[parentMatches.length - 1];
	  let parentParams = routeMatch ? routeMatch.params : {};
	  routeMatch ? routeMatch.pathname : "/";
	  let parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
	  routeMatch && routeMatch.route;
	  let locationFromContext = useLocation();
	  let location;
	  if (locationArg) {
	    var _parsedLocationArg$pa;
	    let parsedLocationArg = typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
	    !(parentPathnameBase === "/" || ((_parsedLocationArg$pa = parsedLocationArg.pathname) == null ? void 0 : _parsedLocationArg$pa.startsWith(parentPathnameBase))) ? invariant(false) : void 0;
	    location = parsedLocationArg;
	  } else {
	    location = locationFromContext;
	  }
	  let pathname = location.pathname || "/";
	  let remainingPathname = pathname;
	  if (parentPathnameBase !== "/") {
	    // Determine the remaining pathname by removing the # of URL segments the
	    // parentPathnameBase has, instead of removing based on character count.
	    // This is because we can't guarantee that incoming/outgoing encodings/
	    // decodings will match exactly.
	    // We decode paths before matching on a per-segment basis with
	    // decodeURIComponent(), but we re-encode pathnames via `new URL()` so they
	    // match what `window.location.pathname` would reflect.  Those don't 100%
	    // align when it comes to encoded URI characters such as % and &.
	    //
	    // So we may end up with:
	    //   pathname:           "/descendant/a%25b/match"
	    //   parentPathnameBase: "/descendant/a%b"
	    //
	    // And the direct substring removal approach won't work :/
	    let parentSegments = parentPathnameBase.replace(/^\//, "").split("/");
	    let segments = pathname.replace(/^\//, "").split("/");
	    remainingPathname = "/" + segments.slice(parentSegments.length).join("/");
	  }
	  let matches = matchRoutes(routes, {
	    pathname: remainingPathname
	  });
	  let renderedMatches = _renderMatches(matches && matches.map(match => Object.assign({}, match, {
	    params: Object.assign({}, parentParams, match.params),
	    pathname: joinPaths([parentPathnameBase,
	    // Re-encode pathnames that were decoded inside matchRoutes
	    navigator.encodeLocation ? navigator.encodeLocation(match.pathname).pathname : match.pathname]),
	    pathnameBase: match.pathnameBase === "/" ? parentPathnameBase : joinPaths([parentPathnameBase,
	    // Re-encode pathnames that were decoded inside matchRoutes
	    navigator.encodeLocation ? navigator.encodeLocation(match.pathnameBase).pathname : match.pathnameBase])
	  })), parentMatches, dataRouterState, future);

	  // When a user passes in a `locationArg`, the associated routes need to
	  // be wrapped in a new `LocationContext.Provider` in order for `useLocation`
	  // to use the scoped location instead of the global location.
	  if (locationArg && renderedMatches) {
	    return /*#__PURE__*/reactExports.createElement(LocationContext.Provider, {
	      value: {
	        location: _extends$1({
	          pathname: "/",
	          search: "",
	          hash: "",
	          state: null,
	          key: "default"
	        }, location),
	        navigationType: Action.Pop
	      }
	    }, renderedMatches);
	  }
	  return renderedMatches;
	}
	function DefaultErrorComponent() {
	  let error = useRouteError();
	  let message = isRouteErrorResponse(error) ? error.status + " " + error.statusText : error instanceof Error ? error.message : JSON.stringify(error);
	  let stack = error instanceof Error ? error.stack : null;
	  let lightgrey = "rgba(200,200,200, 0.5)";
	  let preStyles = {
	    padding: "0.5rem",
	    backgroundColor: lightgrey
	  };
	  let devInfo = null;
	  return /*#__PURE__*/reactExports.createElement(reactExports.Fragment, null, /*#__PURE__*/reactExports.createElement("h2", null, "Unexpected Application Error!"), /*#__PURE__*/reactExports.createElement("h3", {
	    style: {
	      fontStyle: "italic"
	    }
	  }, message), stack ? /*#__PURE__*/reactExports.createElement("pre", {
	    style: preStyles
	  }, stack) : null, devInfo);
	}
	const defaultErrorElement = /*#__PURE__*/reactExports.createElement(DefaultErrorComponent, null);
	class RenderErrorBoundary extends reactExports.Component {
	  constructor(props) {
	    super(props);
	    this.state = {
	      location: props.location,
	      revalidation: props.revalidation,
	      error: props.error
	    };
	  }
	  static getDerivedStateFromError(error) {
	    return {
	      error: error
	    };
	  }
	  static getDerivedStateFromProps(props, state) {
	    // When we get into an error state, the user will likely click "back" to the
	    // previous page that didn't have an error. Because this wraps the entire
	    // application, that will have no effect--the error page continues to display.
	    // This gives us a mechanism to recover from the error when the location changes.
	    //
	    // Whether we're in an error state or not, we update the location in state
	    // so that when we are in an error state, it gets reset when a new location
	    // comes in and the user recovers from the error.
	    if (state.location !== props.location || state.revalidation !== "idle" && props.revalidation === "idle") {
	      return {
	        error: props.error,
	        location: props.location,
	        revalidation: props.revalidation
	      };
	    }

	    // If we're not changing locations, preserve the location but still surface
	    // any new errors that may come through. We retain the existing error, we do
	    // this because the error provided from the app state may be cleared without
	    // the location changing.
	    return {
	      error: props.error !== undefined ? props.error : state.error,
	      location: state.location,
	      revalidation: props.revalidation || state.revalidation
	    };
	  }
	  componentDidCatch(error, errorInfo) {
	    console.error("React Router caught the following error during render", error, errorInfo);
	  }
	  render() {
	    return this.state.error !== undefined ? /*#__PURE__*/reactExports.createElement(RouteContext.Provider, {
	      value: this.props.routeContext
	    }, /*#__PURE__*/reactExports.createElement(RouteErrorContext.Provider, {
	      value: this.state.error,
	      children: this.props.component
	    })) : this.props.children;
	  }
	}
	function RenderedRoute(_ref) {
	  let {
	    routeContext,
	    match,
	    children
	  } = _ref;
	  let dataRouterContext = reactExports.useContext(DataRouterContext);

	  // Track how deep we got in our render pass to emulate SSR componentDidCatch
	  // in a DataStaticRouter
	  if (dataRouterContext && dataRouterContext.static && dataRouterContext.staticContext && (match.route.errorElement || match.route.ErrorBoundary)) {
	    dataRouterContext.staticContext._deepestRenderedBoundaryId = match.route.id;
	  }
	  return /*#__PURE__*/reactExports.createElement(RouteContext.Provider, {
	    value: routeContext
	  }, children);
	}
	function _renderMatches(matches, parentMatches, dataRouterState, future) {
	  var _dataRouterState;
	  if (parentMatches === void 0) {
	    parentMatches = [];
	  }
	  if (dataRouterState === void 0) {
	    dataRouterState = null;
	  }
	  if (future === void 0) {
	    future = null;
	  }
	  if (matches == null) {
	    var _future;
	    if (!dataRouterState) {
	      return null;
	    }
	    if (dataRouterState.errors) {
	      // Don't bail if we have data router errors so we can render them in the
	      // boundary.  Use the pre-matched (or shimmed) matches
	      matches = dataRouterState.matches;
	    } else if ((_future = future) != null && _future.v7_partialHydration && parentMatches.length === 0 && !dataRouterState.initialized && dataRouterState.matches.length > 0) {
	      // Don't bail if we're initializing with partial hydration and we have
	      // router matches.  That means we're actively running `patchRoutesOnNavigation`
	      // so we should render down the partial matches to the appropriate
	      // `HydrateFallback`.  We only do this if `parentMatches` is empty so it
	      // only impacts the root matches for `RouterProvider` and no descendant
	      // `<Routes>`
	      matches = dataRouterState.matches;
	    } else {
	      return null;
	    }
	  }
	  let renderedMatches = matches;

	  // If we have data errors, trim matches to the highest error boundary
	  let errors = (_dataRouterState = dataRouterState) == null ? void 0 : _dataRouterState.errors;
	  if (errors != null) {
	    let errorIndex = renderedMatches.findIndex(m => m.route.id && (errors == null ? void 0 : errors[m.route.id]) !== undefined);
	    !(errorIndex >= 0) ? invariant(false) : void 0;
	    renderedMatches = renderedMatches.slice(0, Math.min(renderedMatches.length, errorIndex + 1));
	  }

	  // If we're in a partial hydration mode, detect if we need to render down to
	  // a given HydrateFallback while we load the rest of the hydration data
	  let renderFallback = false;
	  let fallbackIndex = -1;
	  if (dataRouterState && future && future.v7_partialHydration) {
	    for (let i = 0; i < renderedMatches.length; i++) {
	      let match = renderedMatches[i];
	      // Track the deepest fallback up until the first route without data
	      if (match.route.HydrateFallback || match.route.hydrateFallbackElement) {
	        fallbackIndex = i;
	      }
	      if (match.route.id) {
	        let {
	          loaderData,
	          errors
	        } = dataRouterState;
	        let needsToRunLoader = match.route.loader && loaderData[match.route.id] === undefined && (!errors || errors[match.route.id] === undefined);
	        if (match.route.lazy || needsToRunLoader) {
	          // We found the first route that's not ready to render (waiting on
	          // lazy, or has a loader that hasn't run yet).  Flag that we need to
	          // render a fallback and render up until the appropriate fallback
	          renderFallback = true;
	          if (fallbackIndex >= 0) {
	            renderedMatches = renderedMatches.slice(0, fallbackIndex + 1);
	          } else {
	            renderedMatches = [renderedMatches[0]];
	          }
	          break;
	        }
	      }
	    }
	  }
	  return renderedMatches.reduceRight((outlet, match, index) => {
	    // Only data routers handle errors/fallbacks
	    let error;
	    let shouldRenderHydrateFallback = false;
	    let errorElement = null;
	    let hydrateFallbackElement = null;
	    if (dataRouterState) {
	      error = errors && match.route.id ? errors[match.route.id] : undefined;
	      errorElement = match.route.errorElement || defaultErrorElement;
	      if (renderFallback) {
	        if (fallbackIndex < 0 && index === 0) {
	          warningOnce("route-fallback", false);
	          shouldRenderHydrateFallback = true;
	          hydrateFallbackElement = null;
	        } else if (fallbackIndex === index) {
	          shouldRenderHydrateFallback = true;
	          hydrateFallbackElement = match.route.hydrateFallbackElement || null;
	        }
	      }
	    }
	    let matches = parentMatches.concat(renderedMatches.slice(0, index + 1));
	    let getChildren = () => {
	      let children;
	      if (error) {
	        children = errorElement;
	      } else if (shouldRenderHydrateFallback) {
	        children = hydrateFallbackElement;
	      } else if (match.route.Component) {
	        // Note: This is a de-optimized path since React won't re-use the
	        // ReactElement since it's identity changes with each new
	        // React.createElement call.  We keep this so folks can use
	        // `<Route Component={...}>` in `<Routes>` but generally `Component`
	        // usage is only advised in `RouterProvider` when we can convert it to
	        // `element` ahead of time.
	        children = /*#__PURE__*/reactExports.createElement(match.route.Component, null);
	      } else if (match.route.element) {
	        children = match.route.element;
	      } else {
	        children = outlet;
	      }
	      return /*#__PURE__*/reactExports.createElement(RenderedRoute, {
	        match: match,
	        routeContext: {
	          outlet,
	          matches,
	          isDataRoute: dataRouterState != null
	        },
	        children: children
	      });
	    };
	    // Only wrap in an error boundary within data router usages when we have an
	    // ErrorBoundary/errorElement on this route.  Otherwise let it bubble up to
	    // an ancestor ErrorBoundary/errorElement
	    return dataRouterState && (match.route.ErrorBoundary || match.route.errorElement || index === 0) ? /*#__PURE__*/reactExports.createElement(RenderErrorBoundary, {
	      location: dataRouterState.location,
	      revalidation: dataRouterState.revalidation,
	      component: errorElement,
	      error: error,
	      children: getChildren(),
	      routeContext: {
	        outlet: null,
	        matches,
	        isDataRoute: true
	      }
	    }) : getChildren();
	  }, null);
	}
	var DataRouterHook$1 = /*#__PURE__*/function (DataRouterHook) {
	  DataRouterHook["UseBlocker"] = "useBlocker";
	  DataRouterHook["UseRevalidator"] = "useRevalidator";
	  DataRouterHook["UseNavigateStable"] = "useNavigate";
	  return DataRouterHook;
	}(DataRouterHook$1 || {});
	var DataRouterStateHook$1 = /*#__PURE__*/function (DataRouterStateHook) {
	  DataRouterStateHook["UseBlocker"] = "useBlocker";
	  DataRouterStateHook["UseLoaderData"] = "useLoaderData";
	  DataRouterStateHook["UseActionData"] = "useActionData";
	  DataRouterStateHook["UseRouteError"] = "useRouteError";
	  DataRouterStateHook["UseNavigation"] = "useNavigation";
	  DataRouterStateHook["UseRouteLoaderData"] = "useRouteLoaderData";
	  DataRouterStateHook["UseMatches"] = "useMatches";
	  DataRouterStateHook["UseRevalidator"] = "useRevalidator";
	  DataRouterStateHook["UseNavigateStable"] = "useNavigate";
	  DataRouterStateHook["UseRouteId"] = "useRouteId";
	  return DataRouterStateHook;
	}(DataRouterStateHook$1 || {});
	function useDataRouterContext$1(hookName) {
	  let ctx = reactExports.useContext(DataRouterContext);
	  !ctx ? invariant(false) : void 0;
	  return ctx;
	}
	function useDataRouterState(hookName) {
	  let state = reactExports.useContext(DataRouterStateContext);
	  !state ? invariant(false) : void 0;
	  return state;
	}
	function useRouteContext(hookName) {
	  let route = reactExports.useContext(RouteContext);
	  !route ? invariant(false) : void 0;
	  return route;
	}

	// Internal version with hookName-aware debugging
	function useCurrentRouteId(hookName) {
	  let route = useRouteContext();
	  let thisRoute = route.matches[route.matches.length - 1];
	  !thisRoute.route.id ? invariant(false) : void 0;
	  return thisRoute.route.id;
	}

	/**
	 * Returns the nearest ancestor Route error, which could be a loader/action
	 * error or a render error.  This is intended to be called from your
	 * ErrorBoundary/errorElement to display a proper error message.
	 */
	function useRouteError() {
	  var _state$errors;
	  let error = reactExports.useContext(RouteErrorContext);
	  let state = useDataRouterState(DataRouterStateHook$1.UseRouteError);
	  let routeId = useCurrentRouteId(DataRouterStateHook$1.UseRouteError);

	  // If this was a render error, we put it in a RouteError context inside
	  // of RenderErrorBoundary
	  if (error !== undefined) {
	    return error;
	  }

	  // Otherwise look for errors from our data router state
	  return (_state$errors = state.errors) == null ? void 0 : _state$errors[routeId];
	}

	/**
	 * Stable version of useNavigate that is used when we are in the context of
	 * a RouterProvider.
	 */
	function useNavigateStable() {
	  let {
	    router
	  } = useDataRouterContext$1(DataRouterHook$1.UseNavigateStable);
	  let id = useCurrentRouteId(DataRouterStateHook$1.UseNavigateStable);
	  let activeRef = reactExports.useRef(false);
	  useIsomorphicLayoutEffect(() => {
	    activeRef.current = true;
	  });
	  let navigate = reactExports.useCallback(function (to, options) {
	    if (options === void 0) {
	      options = {};
	    }

	    // Short circuit here since if this happens on first render the navigate
	    // is useless because we haven't wired up our router subscriber yet
	    if (!activeRef.current) return;
	    if (typeof to === "number") {
	      router.navigate(to);
	    } else {
	      router.navigate(to, _extends$1({
	        fromRouteId: id
	      }, options));
	    }
	  }, [router, id]);
	  return navigate;
	}
	const alreadyWarned$1 = {};
	function warningOnce(key, cond, message) {
	  if (!cond && !alreadyWarned$1[key]) {
	    alreadyWarned$1[key] = true;
	  }
	}
	function logV6DeprecationWarnings(renderFuture, routerFuture) {
	  if ((renderFuture == null ? void 0 : renderFuture.v7_startTransition) === undefined) ;
	  if ((renderFuture == null ? void 0 : renderFuture.v7_relativeSplatPath) === undefined && (!routerFuture || routerFuture.v7_relativeSplatPath === undefined)) ;
	  if (routerFuture) {
	    if (routerFuture.v7_fetcherPersist === undefined) ;
	    if (routerFuture.v7_normalizeFormMethod === undefined) ;
	    if (routerFuture.v7_partialHydration === undefined) ;
	    if (routerFuture.v7_skipActionErrorRevalidation === undefined) ;
	  }
	}
	/**
	 * Renders the child route's element, if there is one.
	 *
	 * @see https://reactrouter.com/v6/components/outlet
	 */
	function Outlet(props) {
	  return useOutlet(props.context);
	}
	/**
	 * Declares an element that should be rendered at a certain URL path.
	 *
	 * @see https://reactrouter.com/v6/components/route
	 */
	function Route(_props) {
	  invariant(false) ;
	}
	/**
	 * Provides location context for the rest of the app.
	 *
	 * Note: You usually won't render a `<Router>` directly. Instead, you'll render a
	 * router that is more specific to your environment such as a `<BrowserRouter>`
	 * in web browsers or a `<StaticRouter>` for server rendering.
	 *
	 * @see https://reactrouter.com/v6/router-components/router
	 */
	function Router(_ref5) {
	  let {
	    basename: basenameProp = "/",
	    children = null,
	    location: locationProp,
	    navigationType = Action.Pop,
	    navigator,
	    static: staticProp = false,
	    future
	  } = _ref5;
	  !!useInRouterContext() ? invariant(false) : void 0;

	  // Preserve trailing slashes on basename, so we can let the user control
	  // the enforcement of trailing slashes throughout the app
	  let basename = basenameProp.replace(/^\/*/, "/");
	  let navigationContext = reactExports.useMemo(() => ({
	    basename,
	    navigator,
	    static: staticProp,
	    future: _extends$1({
	      v7_relativeSplatPath: false
	    }, future)
	  }), [basename, future, navigator, staticProp]);
	  if (typeof locationProp === "string") {
	    locationProp = parsePath(locationProp);
	  }
	  let {
	    pathname = "/",
	    search = "",
	    hash = "",
	    state = null,
	    key = "default"
	  } = locationProp;
	  let locationContext = reactExports.useMemo(() => {
	    let trailingPathname = stripBasename(pathname, basename);
	    if (trailingPathname == null) {
	      return null;
	    }
	    return {
	      location: {
	        pathname: trailingPathname,
	        search,
	        hash,
	        state,
	        key
	      },
	      navigationType
	    };
	  }, [basename, pathname, search, hash, state, key, navigationType]);
	  if (locationContext == null) {
	    return null;
	  }
	  return /*#__PURE__*/reactExports.createElement(NavigationContext.Provider, {
	    value: navigationContext
	  }, /*#__PURE__*/reactExports.createElement(LocationContext.Provider, {
	    children: children,
	    value: locationContext
	  }));
	}
	/**
	 * A container for a nested tree of `<Route>` elements that renders the branch
	 * that best matches the current location.
	 *
	 * @see https://reactrouter.com/v6/components/routes
	 */
	function Routes(_ref6) {
	  let {
	    children,
	    location
	  } = _ref6;
	  return useRoutes(createRoutesFromChildren(children), location);
	}
	new Promise(() => {});

	///////////////////////////////////////////////////////////////////////////////
	// UTILS
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Creates a route config from a React "children" object, which is usually
	 * either a `<Route>` element or an array of them. Used internally by
	 * `<Routes>` to create a route config from its children.
	 *
	 * @see https://reactrouter.com/v6/utils/create-routes-from-children
	 */
	function createRoutesFromChildren(children, parentPath) {
	  if (parentPath === void 0) {
	    parentPath = [];
	  }
	  let routes = [];
	  reactExports.Children.forEach(children, (element, index) => {
	    if (! /*#__PURE__*/reactExports.isValidElement(element)) {
	      // Ignore non-elements. This allows people to more easily inline
	      // conditionals in their route config.
	      return;
	    }
	    let treePath = [...parentPath, index];
	    if (element.type === reactExports.Fragment) {
	      // Transparently support React.Fragment and its children.
	      routes.push.apply(routes, createRoutesFromChildren(element.props.children, treePath));
	      return;
	    }
	    !(element.type === Route) ? invariant(false) : void 0;
	    !(!element.props.index || !element.props.children) ? invariant(false) : void 0;
	    let route = {
	      id: element.props.id || treePath.join("-"),
	      caseSensitive: element.props.caseSensitive,
	      element: element.props.element,
	      Component: element.props.Component,
	      index: element.props.index,
	      path: element.props.path,
	      loader: element.props.loader,
	      action: element.props.action,
	      errorElement: element.props.errorElement,
	      ErrorBoundary: element.props.ErrorBoundary,
	      hasErrorBoundary: element.props.ErrorBoundary != null || element.props.errorElement != null,
	      shouldRevalidate: element.props.shouldRevalidate,
	      handle: element.props.handle,
	      lazy: element.props.lazy
	    };
	    if (element.props.children) {
	      route.children = createRoutesFromChildren(element.props.children, treePath);
	    }
	    routes.push(route);
	  });
	  return routes;
	}

	/**
	 * React Router DOM v6.30.6
	 *
	 * Copyright (c) Remix Software Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE.md file in the root directory of this source tree.
	 *
	 * @license MIT
	 */

	function _extends() {
	  return _extends = Object.assign ? Object.assign.bind() : function (n) {
	    for (var e = 1; e < arguments.length; e++) {
	      var t = arguments[e];
	      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
	    }
	    return n;
	  }, _extends.apply(null, arguments);
	}
	function _objectWithoutPropertiesLoose(r, e) {
	  if (null == r) return {};
	  var t = {};
	  for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
	    if (-1 !== e.indexOf(n)) continue;
	    t[n] = r[n];
	  }
	  return t;
	}
	function isModifiedEvent(event) {
	  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
	}
	function shouldProcessLinkClick(event, target) {
	  return event.button === 0 && (
	  // Ignore everything but left clicks
	  !target || target === "_self") &&
	  // Let browser handle "target=_blank" etc.
	  !isModifiedEvent(event) // Ignore clicks with modifier keys
	;
	}
	/**
	 * Creates a URLSearchParams object using the given initializer.
	 *
	 * This is identical to `new URLSearchParams(init)` except it also
	 * supports arrays as values in the object form of the initializer
	 * instead of just strings. This is convenient when you need multiple
	 * values for a given key, but don't want to use an array initializer.
	 *
	 * For example, instead of:
	 *
	 *   let searchParams = new URLSearchParams([
	 *     ['sort', 'name'],
	 *     ['sort', 'price']
	 *   ]);
	 *
	 * you can do:
	 *
	 *   let searchParams = createSearchParams({
	 *     sort: ['name', 'price']
	 *   });
	 */
	function createSearchParams(init) {
	  if (init === void 0) {
	    init = "";
	  }
	  return new URLSearchParams(typeof init === "string" || Array.isArray(init) || init instanceof URLSearchParams ? init : Object.keys(init).reduce((memo, key) => {
	    let value = init[key];
	    return memo.concat(Array.isArray(value) ? value.map(v => [key, v]) : [[key, value]]);
	  }, []));
	}
	function getSearchParamsForLocation(locationSearch, defaultSearchParams) {
	  let searchParams = createSearchParams(locationSearch);
	  if (defaultSearchParams) {
	    // Use `defaultSearchParams.forEach(...)` here instead of iterating of
	    // `defaultSearchParams.keys()` to work-around a bug in Firefox related to
	    // web extensions. Relevant Bugzilla tickets:
	    // https://bugzilla.mozilla.org/show_bug.cgi?id=1414602
	    // https://bugzilla.mozilla.org/show_bug.cgi?id=1023984
	    defaultSearchParams.forEach((_, key) => {
	      if (!searchParams.has(key)) {
	        defaultSearchParams.getAll(key).forEach(value => {
	          searchParams.append(key, value);
	        });
	      }
	    });
	  }
	  return searchParams;
	}

	const _excluded = ["onClick", "relative", "reloadDocument", "replace", "state", "target", "to", "preventScrollReset", "viewTransition"],
	  _excluded2 = ["aria-current", "caseSensitive", "className", "end", "style", "to", "viewTransition", "children"];
	// HEY YOU! DON'T TOUCH THIS VARIABLE!
	//
	// It is replaced with the proper version at build time via a babel plugin in
	// the rollup config.
	//
	// Export a global property onto the window for React Router detection by the
	// Core Web Vitals Technology Report.  This way they can configure the `wappalyzer`
	// to detect and properly classify live websites as being built with React Router:
	// https://github.com/HTTPArchive/wappalyzer/blob/main/src/technologies/r.json
	const REACT_ROUTER_VERSION = "6";
	try {
	  window.__reactRouterVersion = REACT_ROUTER_VERSION;
	} catch (e) {
	  // no-op
	}
	const ViewTransitionContext = /*#__PURE__*/reactExports.createContext({
	  isTransitioning: false
	});
	//#endregion
	////////////////////////////////////////////////////////////////////////////////
	//#region Components
	////////////////////////////////////////////////////////////////////////////////
	/**
	  Webpack + React 17 fails to compile on any of the following because webpack
	  complains that `startTransition` doesn't exist in `React`:
	  * import { startTransition } from "react"
	  * import * as React from from "react";
	    "startTransition" in React ? React.startTransition(() => setState()) : setState()
	  * import * as React from from "react";
	    "startTransition" in React ? React["startTransition"](() => setState()) : setState()

	  Moving it to a constant such as the following solves the Webpack/React 17 issue:
	  * import * as React from from "react";
	    const START_TRANSITION = "startTransition";
	    START_TRANSITION in React ? React[START_TRANSITION](() => setState()) : setState()

	  However, that introduces webpack/terser minification issues in production builds
	  in React 18 where minification/obfuscation ends up removing the call of
	  React.startTransition entirely from the first half of the ternary.  Grabbing
	  this exported reference once up front resolves that issue.

	  See https://github.com/remix-run/react-router/issues/10579
	*/
	const START_TRANSITION = "startTransition";
	const startTransitionImpl = React$1[START_TRANSITION];
	/**
	 * A `<Router>` for use in web browsers. Provides the cleanest URLs.
	 */
	function BrowserRouter(_ref4) {
	  let {
	    basename,
	    children,
	    future,
	    window
	  } = _ref4;
	  let historyRef = reactExports.useRef();
	  if (historyRef.current == null) {
	    historyRef.current = createBrowserHistory({
	      window,
	      v5Compat: true
	    });
	  }
	  let history = historyRef.current;
	  let [state, setStateImpl] = reactExports.useState({
	    action: history.action,
	    location: history.location
	  });
	  let {
	    v7_startTransition
	  } = future || {};
	  let setState = reactExports.useCallback(newState => {
	    v7_startTransition && startTransitionImpl ? startTransitionImpl(() => setStateImpl(newState)) : setStateImpl(newState);
	  }, [setStateImpl, v7_startTransition]);
	  reactExports.useLayoutEffect(() => history.listen(setState), [history, setState]);
	  reactExports.useEffect(() => logV6DeprecationWarnings(future), [future]);
	  return /*#__PURE__*/reactExports.createElement(Router, {
	    basename: basename,
	    children: children,
	    location: state.location,
	    navigationType: state.action,
	    navigator: history,
	    future: future
	  });
	}
	const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined";
	const ABSOLUTE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
	/**
	 * The public API for rendering a history-aware `<a>`.
	 */
	const Link = /*#__PURE__*/reactExports.forwardRef(function LinkWithRef(_ref7, ref) {
	  let {
	      onClick,
	      relative,
	      reloadDocument,
	      replace,
	      state,
	      target,
	      to,
	      preventScrollReset,
	      viewTransition
	    } = _ref7,
	    rest = _objectWithoutPropertiesLoose(_ref7, _excluded);
	  let {
	    basename
	  } = reactExports.useContext(NavigationContext);
	  // Rendered into <a href> for absolute URLs
	  let absoluteHref;
	  let isExternal = false;
	  if (typeof to === "string" && ABSOLUTE_URL_REGEX.test(to)) {
	    // Render the absolute href server- and client-side
	    absoluteHref = to;
	    // Only check for external origins client-side
	    if (isBrowser) {
	      try {
	        let currentUrl = new URL(window.location.href);
	        let targetUrl = to.startsWith("//") ? new URL(currentUrl.protocol + to) : new URL(to);
	        let path = stripBasename(targetUrl.pathname, basename);
	        if (targetUrl.origin === currentUrl.origin && path != null) {
	          // Strip the protocol/origin/basename for same-origin absolute URLs
	          to = path + targetUrl.search + targetUrl.hash;
	        } else {
	          isExternal = true;
	        }
	      } catch (e) {
	      }
	    }
	  }
	  // Rendered into <a href> for relative URLs
	  let href = useHref(to, {
	    relative
	  });
	  let internalOnClick = useLinkClickHandler(to, {
	    replace,
	    state,
	    target,
	    preventScrollReset,
	    relative,
	    viewTransition
	  });
	  function handleClick(event) {
	    if (onClick) onClick(event);
	    if (!event.defaultPrevented) {
	      internalOnClick(event);
	    }
	  }
	  return (
	    /*#__PURE__*/
	    // eslint-disable-next-line jsx-a11y/anchor-has-content
	    reactExports.createElement("a", _extends({}, rest, {
	      href: absoluteHref || href,
	      onClick: isExternal || reloadDocument ? onClick : handleClick,
	      ref: ref,
	      target: target
	    }))
	  );
	});
	/**
	 * A `<Link>` wrapper that knows if it's "active" or not.
	 */
	const NavLink = /*#__PURE__*/reactExports.forwardRef(function NavLinkWithRef(_ref8, ref) {
	  let {
	      "aria-current": ariaCurrentProp = "page",
	      caseSensitive = false,
	      className: classNameProp = "",
	      end = false,
	      style: styleProp,
	      to,
	      viewTransition,
	      children
	    } = _ref8,
	    rest = _objectWithoutPropertiesLoose(_ref8, _excluded2);
	  let path = useResolvedPath(to, {
	    relative: rest.relative
	  });
	  let location = useLocation();
	  let routerState = reactExports.useContext(DataRouterStateContext);
	  let {
	    navigator,
	    basename
	  } = reactExports.useContext(NavigationContext);
	  let isTransitioning = routerState != null &&
	  // Conditional usage is OK here because the usage of a data router is static
	  // eslint-disable-next-line react-hooks/rules-of-hooks
	  useViewTransitionState(path) && viewTransition === true;
	  let toPathname = navigator.encodeLocation ? navigator.encodeLocation(path).pathname : path.pathname;
	  let locationPathname = location.pathname;
	  let nextLocationPathname = routerState && routerState.navigation && routerState.navigation.location ? routerState.navigation.location.pathname : null;
	  if (!caseSensitive) {
	    locationPathname = locationPathname.toLowerCase();
	    nextLocationPathname = nextLocationPathname ? nextLocationPathname.toLowerCase() : null;
	    toPathname = toPathname.toLowerCase();
	  }
	  if (nextLocationPathname && basename) {
	    nextLocationPathname = stripBasename(nextLocationPathname, basename) || nextLocationPathname;
	  }
	  // If the `to` has a trailing slash, look at that exact spot.  Otherwise,
	  // we're looking for a slash _after_ what's in `to`.  For example:
	  //
	  // <NavLink to="/users"> and <NavLink to="/users/">
	  // both want to look for a / at index 6 to match URL `/users/matt`
	  const endSlashPosition = toPathname !== "/" && toPathname.endsWith("/") ? toPathname.length - 1 : toPathname.length;
	  let isActive = locationPathname === toPathname || !end && locationPathname.startsWith(toPathname) && locationPathname.charAt(endSlashPosition) === "/";
	  let isPending = nextLocationPathname != null && (nextLocationPathname === toPathname || !end && nextLocationPathname.startsWith(toPathname) && nextLocationPathname.charAt(toPathname.length) === "/");
	  let renderProps = {
	    isActive,
	    isPending,
	    isTransitioning
	  };
	  let ariaCurrent = isActive ? ariaCurrentProp : undefined;
	  let className;
	  if (typeof classNameProp === "function") {
	    className = classNameProp(renderProps);
	  } else {
	    // If the className prop is not a function, we use a default `active`
	    // class for <NavLink />s that are active. In v5 `active` was the default
	    // value for `activeClassName`, but we are removing that API and can still
	    // use the old default behavior for a cleaner upgrade path and keep the
	    // simple styling rules working as they currently do.
	    className = [classNameProp, isActive ? "active" : null, isPending ? "pending" : null, isTransitioning ? "transitioning" : null].filter(Boolean).join(" ");
	  }
	  let style = typeof styleProp === "function" ? styleProp(renderProps) : styleProp;
	  return /*#__PURE__*/reactExports.createElement(Link, _extends({}, rest, {
	    "aria-current": ariaCurrent,
	    className: className,
	    ref: ref,
	    style: style,
	    to: to,
	    viewTransition: viewTransition
	  }), typeof children === "function" ? children(renderProps) : children);
	});
	//#endregion
	////////////////////////////////////////////////////////////////////////////////
	//#region Hooks
	////////////////////////////////////////////////////////////////////////////////
	var DataRouterHook;
	(function (DataRouterHook) {
	  DataRouterHook["UseScrollRestoration"] = "useScrollRestoration";
	  DataRouterHook["UseSubmit"] = "useSubmit";
	  DataRouterHook["UseSubmitFetcher"] = "useSubmitFetcher";
	  DataRouterHook["UseFetcher"] = "useFetcher";
	  DataRouterHook["useViewTransitionState"] = "useViewTransitionState";
	})(DataRouterHook || (DataRouterHook = {}));
	var DataRouterStateHook;
	(function (DataRouterStateHook) {
	  DataRouterStateHook["UseFetcher"] = "useFetcher";
	  DataRouterStateHook["UseFetchers"] = "useFetchers";
	  DataRouterStateHook["UseScrollRestoration"] = "useScrollRestoration";
	})(DataRouterStateHook || (DataRouterStateHook = {}));
	function useDataRouterContext(hookName) {
	  let ctx = reactExports.useContext(DataRouterContext);
	  !ctx ? invariant(false) : void 0;
	  return ctx;
	}
	// External hooks
	/**
	 * Handles the click behavior for router `<Link>` components. This is useful if
	 * you need to create custom `<Link>` components with the same click behavior we
	 * use in our exported `<Link>`.
	 */
	function useLinkClickHandler(to, _temp) {
	  let {
	    target,
	    replace: replaceProp,
	    state,
	    preventScrollReset,
	    relative,
	    viewTransition
	  } = _temp === void 0 ? {} : _temp;
	  let navigate = useNavigate();
	  let location = useLocation();
	  let path = useResolvedPath(to, {
	    relative
	  });
	  return reactExports.useCallback(event => {
	    if (shouldProcessLinkClick(event, target)) {
	      event.preventDefault();
	      // If the URL hasn't changed, a regular <a> will do a replace instead of
	      // a push, so do the same here unless the replace prop is explicitly set
	      let replace = replaceProp !== undefined ? replaceProp : createPath(location) === createPath(path);
	      navigate(to, {
	        replace,
	        state,
	        preventScrollReset,
	        relative,
	        viewTransition
	      });
	    }
	  }, [location, navigate, path, replaceProp, state, target, to, preventScrollReset, relative, viewTransition]);
	}
	/**
	 * A convenient wrapper for reading and writing search parameters via the
	 * URLSearchParams interface.
	 */
	function useSearchParams(defaultInit) {
	  let defaultSearchParamsRef = reactExports.useRef(createSearchParams(defaultInit));
	  let hasSetSearchParamsRef = reactExports.useRef(false);
	  let location = useLocation();
	  let searchParams = reactExports.useMemo(() =>
	  // Only merge in the defaults if we haven't yet called setSearchParams.
	  // Once we call that we want those to take precedence, otherwise you can't
	  // remove a param with setSearchParams({}) if it has an initial value
	  getSearchParamsForLocation(location.search, hasSetSearchParamsRef.current ? null : defaultSearchParamsRef.current), [location.search]);
	  let navigate = useNavigate();
	  let setSearchParams = reactExports.useCallback((nextInit, navigateOptions) => {
	    const newSearchParams = createSearchParams(typeof nextInit === "function" ? nextInit(searchParams) : nextInit);
	    hasSetSearchParamsRef.current = true;
	    navigate("?" + newSearchParams, navigateOptions);
	  }, [navigate, searchParams]);
	  return [searchParams, setSearchParams];
	}
	/**
	 * Return a boolean indicating if there is an active view transition to the
	 * given href.  You can use this value to render CSS classes or viewTransitionName
	 * styles onto your elements
	 *
	 * @param href The destination href
	 * @param [opts.relative] Relative routing type ("route" | "path")
	 */
	function useViewTransitionState(to, opts) {
	  if (opts === void 0) {
	    opts = {};
	  }
	  let vtContext = reactExports.useContext(ViewTransitionContext);
	  !(vtContext != null) ? invariant(false) : void 0;
	  let {
	    basename
	  } = useDataRouterContext(DataRouterHook.useViewTransitionState);
	  let path = useResolvedPath(to, {
	    relative: opts.relative
	  });
	  if (!vtContext.isTransitioning) {
	    return false;
	  }
	  let currentPath = stripBasename(vtContext.currentLocation.pathname, basename) || vtContext.currentLocation.pathname;
	  let nextPath = stripBasename(vtContext.nextLocation.pathname, basename) || vtContext.nextLocation.pathname;
	  // Transition is active if we're going to or coming from the indicated
	  // destination.  This ensures that other PUSH navigations that reverse
	  // an indicated transition apply.  I.e., on the list view you have:
	  //
	  //   <NavLink to="/details/1" viewTransition>
	  //
	  // If you click the breadcrumb back to the list view:
	  //
	  //   <NavLink to="/list" viewTransition>
	  //
	  // We should apply the transition because it's indicated as active going
	  // from /list -> /details/1 and therefore should be active on the reverse
	  // (even though this isn't strictly a POP reverse)
	  return matchPath(path.pathname, nextPath) != null || matchPath(path.pathname, currentPath) != null;
	}

	var jsxRuntime = {exports: {}};

	var reactJsxRuntime_production_min = {};

	/**
	 * @license React
	 * react-jsx-runtime.production.min.js
	 *
	 * Copyright (c) Facebook, Inc. and its affiliates.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */
	var f=reactExports,k=Symbol.for("react.element"),l=Symbol.for("react.fragment"),m=Object.prototype.hasOwnProperty,n=f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,p={key:!0,ref:!0,__self:!0,__source:!0};
	function q(c,a,g){var b,d={},e=null,h=null;void 0!==g&&(e=""+g);void 0!==a.key&&(e=""+a.key);void 0!==a.ref&&(h=a.ref);for(b in a)m.call(a,b)&&!p.hasOwnProperty(b)&&(d[b]=a[b]);if(c&&c.defaultProps)for(b in a=c.defaultProps,a)void 0===d[b]&&(d[b]=a[b]);return {$$typeof:k,type:c,key:e,ref:h,props:d,_owner:n.current}}reactJsxRuntime_production_min.Fragment=l;reactJsxRuntime_production_min.jsx=q;reactJsxRuntime_production_min.jsxs=q;

	{
	  jsxRuntime.exports = reactJsxRuntime_production_min;
	}

	var jsxRuntimeExports = jsxRuntime.exports;

	// Inline stroke icons (Lucide-style). No emoji, per design checklist.
	const P = {
	  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
	  user: '<path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/>',
	  heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
	  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
	  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
	  x: '<path d="M18 6 6 18M6 6l12 12"/>',
	  chevronRight: '<path d="m9 18 6-6-6-6"/>',
	  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
	  chevronDown: '<path d="m6 9 6 6 6-6"/>',
	  chevronUp: '<path d="m18 15-6-6-6 6"/>',
	  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
	  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/>',
	  plus: '<path d="M12 5v14M5 12h14"/>',
	  minus: '<path d="M5 12h14"/>',
	  truck: '<path d="M14 18V6a1 1 0 0 0-1-1H2v13"/><path d="M14 9h4l3 3v6h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
	  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
	  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 12-4 16-9 16Z"/><path d="M4 20c4-4 8-6 12-7"/>',
	  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
	  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
	  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
	  check: '<path d="m20 6-11 11-5-5"/>',
	  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
	  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
	  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/>',
	  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
	  tag: '<path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0l-6-6a1 1 0 0 1-.3-.7V4a1 1 0 0 1 1-1h9.3a1 1 0 0 1 .7.3l6 6a2 2 0 0 1 0 2.9Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
	  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
	  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
	  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
	  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
	  package: '<path d="m21 8-9-5-9 5v8l9 5 9-5Z"/><path d="M3 8l9 5 9-5M12 13v9"/>',
	  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
	  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
	  droplet: '<path d="M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0Z"/>',
	  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M12 8S10 2 7 4s5 4 5 4ZM12 8s2-6 5-4-5 4-5 4Z"/>',
	  award: '<circle cx="12" cy="9" r="6"/><path d="m9 14-1.5 7L12 18l4.5 3L15 14"/>',
	  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1A4 4 0 0 1 16 11"/>',
	  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2Z"/>',
	  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
	  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.2A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.4H3a2 2 0 0 1 0-4h.2A1.6 1.6 0 0 0 5 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.9V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-1.1 2.7H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z"/>',
	  instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
	  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/>',
	  twitter: '<path d="M22 4c-.9.6-2 1-3 1.2A4.5 4.5 0 0 0 12 9v1A11 11 0 0 1 3 5s-4 9 5 13a12 12 0 0 1-7 2c9 5 20 0 20-11.5 0-.3 0-.6-.1-.8A7.7 7.7 0 0 0 22 4Z"/>',
	  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
	  return: '<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.4-9.5L3 7"/>',
	  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7 15h10"/>',
	  heartHand: '<path d="M11 14 8.5 11.5a2 2 0 1 1 2.8-2.8l.7.7.7-.7a2 2 0 1 1 2.8 2.8L13 14a1.4 1.4 0 0 1-2 0Z"/><path d="M4 15v5a1 1 0 0 0 1 1h2v-8H5a1 1 0 0 0-1 1Z"/>'
	};
	function Icon({
	  name,
	  size = 22,
	  stroke = 1.6,
	  fill = 'none',
	  className,
	  style
	}) {
	  const d = P[name];
	  if (!d) return null;
	  return /*#__PURE__*/jsxRuntimeExports.jsx("svg", {
	    width: size,
	    height: size,
	    viewBox: "0 0 24 24",
	    fill: fill,
	    stroke: "currentColor",
	    strokeWidth: stroke,
	    strokeLinecap: "round",
	    strokeLinejoin: "round",
	    className: className,
	    style: style,
	    "aria-hidden": "true",
	    dangerouslySetInnerHTML: {
	      __html: d
	    }
	  });
	}

	const LOGO_SRC = '/assets/sora-life-logo.png';

	// Fallback vector sparrow + berry (shown until the raster logo is present,
	// and in light/dark contexts like the footer where the dark logo art would
	// be invisible). Kept from the previous implementation.
	function SparrowMark({
	  size = 26,
	  light = false
	}) {
	  const green = light ? '#FBF8F1' : 'var(--forest-700)';
	  const gold = 'var(--honey-500)';
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("svg", {
	    width: size,
	    height: size * 0.75,
	    viewBox: "0 0 44 32",
	    fill: "none",
	    "aria-hidden": "true",
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("circle", {
	      cx: "4.4",
	      cy: "12.4",
	      r: "2.6",
	      fill: gold
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("path", {
	      d: "M4.4 9.9c.9.6.9 1.9 0 2.5",
	      stroke: green,
	      strokeWidth: "0.6",
	      opacity: "0.5"
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("path", {
	      d: "M8.5 13.4 C10.6 11 14 10.2 17 12 C24 8 32 6 40.5 4 C34.5 10 30.5 13.8 26.6 16.6 C24.6 21.6 19.6 24.8 14.2 23 C11.4 22 9.4 20 9.2 17.2 L5 13.6 Z",
	      fill: green
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("path", {
	      d: "M15.5 15.2 C19.5 16.4 23.4 15.4 27 13.2",
	      stroke: light ? '#1E3A2F' : 'var(--honey-300)',
	      strokeWidth: "1.1",
	      strokeLinecap: "round",
	      opacity: "0.75",
	      fill: "none"
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("circle", {
	      cx: "11.4",
	      cy: "14",
	      r: "0.9",
	      fill: light ? '#1E3A2F' : '#0F1F17'
	    })]
	  });
	}
	function Logo({
	  compact = false,
	  light = false,
	  tagline = true
	}) {
	  const [imgOk, setImgOk] = reactExports.useState(true);
	  const fg = light ? '#FBF8F1' : 'var(--forest-700)';
	  const sub = light ? 'rgba(251,248,241,0.72)' : 'var(--ink-500)';

	  // Use the official raster logo in the header (non-light contexts).
	  if (!light && imgOk) {
	    return /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	      to: "/",
	      className: `logo logo--img ${compact ? 'logo--compact' : ''}`,
	      "aria-label": "Sora Life \u2014 Health and Wellness",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx("img", {
	        src: LOGO_SRC,
	        alt: "Sora Life \u2014 Health and Wellness",
	        className: "logo__img",
	        onError: () => setImgOk(false)
	      })
	    });
	  }

	  // Vector fallback (footer / dark surfaces / until the asset is added).
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	    to: "/",
	    className: "logo",
	    "aria-label": "Sora Life home",
	    style: {
	      display: 'inline-flex',
	      flexDirection: 'column',
	      alignItems: 'center',
	      lineHeight: 1
	    },
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	      style: {
	        marginBottom: 4,
	        display: 'inline-flex'
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsx(SparrowMark, {
	        size: compact ? 24 : 30,
	        light: light
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	      style: {
	        fontFamily: 'var(--font-display)',
	        fontWeight: 600,
	        fontSize: compact ? '1.15rem' : '1.4rem',
	        letterSpacing: '0.12em',
	        color: fg
	      },
	      children: "SORA LIFE"
	    }), tagline && !compact && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	      style: {
	        fontFamily: 'var(--font-sans)',
	        fontSize: '0.5rem',
	        letterSpacing: '0.34em',
	        color: sub,
	        marginTop: 4,
	        fontWeight: 600
	      },
	      children: "HEALTH & WELLNESS"
	    })]
	  });
	}

	// ============================================================
	// STOREFRONT CATEGORIES — the 8 circles on the homepage.
	// Mapped from the real Biosash catalog (see biosash.js). Order
	// matches the homepage category strip.
	// ============================================================
	const categories = [{
	  slug: 'wellness',
	  name: 'Wellness',
	  tagline: 'Everyday Himalayan wellness',
	  tone: 'forest',
	  blurb: 'Sea-buckthorn health essentials for daily balance and vitality.',
	  icon: 'heart'
	}, {
	  slug: 'juices-drinks',
	  name: 'Juices & Drinks',
	  tagline: 'Cold-pressed nutrition',
	  tone: 'lime',
	  blurb: 'Nutritional juices and drinks powered by Himalayan sea buckthorn.',
	  icon: 'bottle'
	}, {
	  slug: 'supplements',
	  name: 'Supplements',
	  tagline: 'Herbal & Ayurvedic support',
	  tone: 'clay',
	  blurb: 'Ayurvedic and herbal supplements for targeted daily support.',
	  icon: 'capsule'
	}, {
	  slug: 'skin-care',
	  name: 'Skin Care',
	  tagline: 'Radiance, naturally',
	  tone: 'rose',
	  blurb: 'Serums, creams and cleansers rich in sea-buckthorn oil.',
	  icon: 'sparkle'
	}, {
	  slug: 'hair-care',
	  name: 'Hair Care',
	  tagline: 'Roots to ends',
	  tone: 'plum',
	  blurb: 'Shampoos, oils and treatments for stronger, healthier hair.',
	  icon: 'drop'
	}, {
	  slug: 'bath-body',
	  name: 'Bath & Body',
	  tagline: 'Soaps & body rituals',
	  tone: 'teal',
	  blurb: 'Handmade soaps, body oils and washes for nourished skin.',
	  icon: 'shield'
	}, {
	  slug: 'mens-care',
	  name: "Men's Care",
	  tagline: 'Grooming essentials',
	  tone: 'moss',
	  blurb: 'Beard, shave and grooming essentials made for men.',
	  icon: 'star'
	}, {
	  slug: 'personal-care',
	  name: 'Personal Care',
	  tagline: 'Hygiene & daily care',
	  tone: 'sky',
	  blurb: 'Everyday hygiene and personal-care essentials.',
	  icon: 'sparkle'
	}];
	const categoryBySlug = Object.fromEntries(categories.map(c => [c.slug, c]));

	// Tone → gradient/accent used by fallback tiles and category theming.
	const tones = {
	  forest: {
	    a: '#2C5341',
	    b: '#1E3A2F',
	    accent: '#E8B04B',
	    tint: '#E1EEE7'
	  },
	  lime: {
	    a: '#5B8C3A',
	    b: '#3E6B2A',
	    accent: '#F0C169',
	    tint: '#EAF3DD'
	  },
	  amber: {
	    a: '#C98A32',
	    b: '#A96C1E',
	    accent: '#FBE9C8',
	    tint: '#FDF4E4'
	  },
	  clay: {
	    a: '#C56A45',
	    b: '#9E4E2F',
	    accent: '#F6D79A',
	    tint: '#F7E7DF'
	  },
	  moss: {
	    a: '#586E3A',
	    b: '#3D4F26',
	    accent: '#E8B04B',
	    tint: '#E9EEDD'
	  },
	  plum: {
	    a: '#7A5476',
	    b: '#573A54',
	    accent: '#F0C169',
	    tint: '#EEE4EC'
	  },
	  rose: {
	    a: '#C57389',
	    b: '#9E5065',
	    accent: '#F6D79A',
	    tint: '#F6E6EA'
	  },
	  honey: {
	    a: '#D9A441',
	    b: '#B47F22',
	    accent: '#FBE9C8',
	    tint: '#FBF1DD'
	  },
	  teal: {
	    a: '#2E7D74',
	    b: '#1E5A53',
	    accent: '#F0C169',
	    tint: '#DDEEEB'
	  },
	  sky: {
	    a: '#4E82A8',
	    b: '#356184',
	    accent: '#F6D79A',
	    tint: '#E1ECF3'
	  }
	};

	function ProductImage({
	  product,
	  className = '',
	  index = 0
	}) {
	  const [failed, setFailed] = reactExports.useState(false);
	  if (!product) return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	    className: `pimg ${className}`,
	    style: {
	      background: 'var(--cream)'
	    }
	  });
	  const cat = categoryBySlug[product.category];
	  const t = tones[cat?.tone] || tones.forest;
	  const src = index === 0 ? product.image : product.gallery && product.gallery[index] || product.image;
	  if (src && !failed) {
	    return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: `pimg ${className}`,
	      children: /*#__PURE__*/jsxRuntimeExports.jsx("img", {
	        src: src,
	        alt: product.name,
	        loading: "lazy",
	        decoding: "async",
	        onError: () => setFailed(true),
	        style: {
	          width: '100%',
	          height: '100%',
	          objectFit: 'cover'
	        }
	      })
	    });
	  }

	  // Fallback branded tile
	  return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	    className: `pimg ${className}`,
	    style: {
	      background: `linear-gradient(150deg, ${t.tint}, #fff)`
	    },
	    children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      style: {
	        position: 'absolute',
	        inset: 0,
	        display: 'grid',
	        placeItems: 'center',
	        color: t.b,
	        textAlign: 'center',
	        padding: 16
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          style: {
	            fontFamily: 'var(--font-display)',
	            fontWeight: 600,
	            fontSize: 14,
	            letterSpacing: 1
	          },
	          children: "SORA LIFE"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          style: {
	            fontSize: 10,
	            letterSpacing: 2,
	            marginTop: 4,
	            textTransform: 'uppercase'
	          },
	          children: cat?.name
	        })]
	      })
	    })
	  });
	}

	// AUTO-GENERATED from the official Biosash WooCommerce Store API.
	// Facts only (name, price, size, category, stock, official image URLs).
	// Regenerate with: python scripts_build_catalog.py
	const BIOSASH_PRODUCTS = [{
	  "id": "b171",
	  "slug": "after-shave-lotion-for-men",
	  "name": "After Shave Lotion For Men",
	  "category": "mens-care",
	  "categories": ["mens-care"],
	  "price": 240,
	  "mrp": 240,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b171.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-After-Shave-Lotion-For-Men.png"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/after-shave-lotion-for-men/"
	}, {
	  "id": "b183",
	  "slug": "beard-cream",
	  "name": "Beard Cream",
	  "category": "mens-care",
	  "categories": ["mens-care"],
	  "price": 295,
	  "mrp": 295,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b183.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Beard-Cream.png", "https://biosash.com/wp-content/uploads/2020/10/01-15.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-15.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-15.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/beard-cream/"
	}, {
	  "id": "b185",
	  "slug": "beard-wash",
	  "name": "Beard Wash",
	  "category": "mens-care",
	  "categories": ["mens-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b185.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-Beard-Wash.png", "https://biosash.com/wp-content/uploads/2020/10/01-17.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-17.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-17.jpg"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/beard-wash/"
	}, {
	  "id": "b181",
	  "slug": "beard-and-mooch-oil",
	  "name": "Beard and Mooch Oil",
	  "category": "mens-care",
	  "categories": ["mens-care"],
	  "price": 245,
	  "mrp": 245,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b181.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-BEARD-AND-MOOCH-OIL.png", "https://biosash.com/wp-content/uploads/2020/10/01-16.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-16.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-16.jpg"],
	  "form": "50ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/beard-and-mooch-oil/"
	}, {
	  "id": "b400",
	  "slug": "hair-pomade-for-men",
	  "name": "Hair Pomade For Men",
	  "category": "mens-care",
	  "categories": ["mens-care", "hair-care"],
	  "price": 295,
	  "mrp": 295,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b400.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Hair-Pomed.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/hair-pomade-for-men/"
	}, {
	  "id": "b401",
	  "slug": "liquid-wash-intimate-men",
	  "name": "Liquid Wash Intimate Men",
	  "category": "mens-care",
	  "categories": ["mens-care", "bath-body"],
	  "price": 295,
	  "mrp": 295,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b401.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-Liquid-Wash-Intimate-Men.png"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/liquid-wash-intimate-men/"
	}, {
	  "id": "b224",
	  "slug": "mouch-wax",
	  "name": "Mouch Wax",
	  "category": "mens-care",
	  "categories": ["mens-care"],
	  "price": 330,
	  "mrp": 330,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b224.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/mouch-wax.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/mouch-wax/"
	}, {
	  "id": "b1348",
	  "slug": "bioflex-cold-pressed-flex-seed-oil",
	  "name": "Bio Flex Cold Pressed Flex Seed Oil",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 900,
	  "mrp": 900,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1348.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2021/10/BioFlex-Flexseed-Oil.png"],
	  "form": "500ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/bioflex-cold-pressed-flex-seed-oil/"
	}, {
	  "id": "b126",
	  "slug": "black-seed-oil-capsule",
	  "name": "Black Seed Oil Capsule",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1687,
	  "mrp": 1687,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b126.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Black-Seed-oil.png"],
	  "form": "60 Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/black-seed-oil-capsule/"
	}, {
	  "id": "b372",
	  "slug": "calsash-tablets",
	  "name": "Calsash Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 587,
	  "mrp": 587,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b372.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Calsah.png"],
	  "form": "60 Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/calsash-tablets/"
	}, {
	  "id": "b129",
	  "slug": "cocosash-tablets",
	  "name": "Cocosash Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1201,
	  "mrp": 1201,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b129.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Cocosash.png"],
	  "form": "60 Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/cocosash-tablets/"
	}, {
	  "id": "b1420",
	  "slug": "collagen-builder-tablets",
	  "name": "Collagen Builder Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1023,
	  "mrp": 1023,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1420.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2022/12/Biosash-Collagan-Builder.png"],
	  "form": "60 Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/collagen-builder-tablets/"
	}, {
	  "id": "b197",
	  "slug": "diabosash-capsules",
	  "name": "Diabosash Capsules",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1150,
	  "mrp": 1150,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b197.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Biosash-Diabosash.png", "https://biosash.com/wp-content/uploads/2020/10/01-14.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-14.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-14.jpg"],
	  "form": "60 Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/diabosash-capsules/"
	}, {
	  "id": "b1422",
	  "slug": "empower-tablets",
	  "name": "Empower Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1023,
	  "mrp": 1023,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1422.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2022/12/Biosash-Empower-Tablets.png"],
	  "form": "60 Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/empower-tablets/"
	}, {
	  "id": "b1432",
	  "slug": "empower-x-tablets",
	  "name": "Empower-X Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1828,
	  "mrp": 1828,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1432.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/01/Biosash-Empower-X.png", "https://biosash.com/wp-content/uploads/2023/01/01.jpg", "https://biosash.com/wp-content/uploads/2023/01/02.jpg"],
	  "form": "30Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/empower-x-tablets/"
	}, {
	  "id": "b1424",
	  "slug": "femsash-tablets",
	  "name": "Femsash Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1023,
	  "mrp": 1023,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1424.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2022/12/Biosash-Femsash-tablets.png"],
	  "form": "60 Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/femsash-tablets/"
	}, {
	  "id": "b1602",
	  "slug": "immunosash-capsules-30-capsules",
	  "name": "Immunosash Capsules (30 Capsules)",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 2400,
	  "mrp": 2400,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1602.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/02/Immunosash.png"],
	  "form": "30Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/immunosash-capsules-30-capsules/"
	}, {
	  "id": "b127",
	  "slug": "leucosash-capsule",
	  "name": "Leucosash Capsules",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 797,
	  "mrp": 797,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b127.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Biosash-Leucosash-2.png", "https://biosash.com/wp-content/uploads/2020/10/01-34.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-34.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-34.jpg"],
	  "form": "60 Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/leucosash-capsule/"
	}, {
	  "id": "b1313",
	  "slug": "liver-kidney-support",
	  "name": "Liver And Kidney Support Capsules",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 712,
	  "mrp": 712,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1313.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2021/04/Biosash-Liver-Kidney-Support.png", "https://biosash.com/wp-content/uploads/2020/10/01-28.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-28.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-28.jpg"],
	  "form": "60 Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/liver-kidney-support/"
	}, {
	  "id": "b110",
	  "slug": "nonisash",
	  "name": "Nonisash Capsule",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 712,
	  "mrp": 712,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b110.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Biosash-Noni.png"],
	  "form": "60 Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/nonisash/"
	}, {
	  "id": "b1473",
	  "slug": "orthosash-pain-oil",
	  "name": "Orthosash Pain Oil",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 390,
	  "mrp": 390,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1473.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/05/01.jpg", "https://biosash.com/wp-content/uploads/2023/05/ORTHOSASH-PAIN-OIL.webp", "https://biosash.com/wp-content/uploads/2023/05/02.jpg", "https://biosash.com/wp-content/uploads/2023/05/03.jpg"],
	  "form": "60ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/orthosash-pain-oil/"
	}, {
	  "id": "b128",
	  "slug": "orthosash-capsule",
	  "name": "Orthosash Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 850,
	  "mrp": 850,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b128.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Biosash-Orthosash.png", "https://biosash.com/wp-content/uploads/2020/10/01-35.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-35.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-35.jpg"],
	  "form": "60 Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/orthosash-capsule/"
	}, {
	  "id": "b165",
	  "slug": "panch-tulsi-drops",
	  "name": "Panch Tulsi Drops",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 460,
	  "mrp": 460,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b165.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Panch-Tulsi.png", "https://biosash.com/wp-content/uploads/2020/10/01-31.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-31.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-31.jpg"],
	  "form": "20ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/panch-tulsi-drops/"
	}, {
	  "id": "b249",
	  "slug": "seabuckthorn-berry-oil-capsule",
	  "name": "Sea Buckthorn Berry Oil Capsule",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 2715,
	  "mrp": 2715,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b249.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Seabuckthorn-Berry-Oil.png", "https://biosash.com/wp-content/uploads/2023/10/01-4.jpg", "https://biosash.com/wp-content/uploads/2023/10/02-4.jpg", "https://biosash.com/wp-content/uploads/2023/10/03-4.jpg"],
	  "form": "30 Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-berry-oil-capsule/"
	}, {
	  "id": "b1680",
	  "slug": "seabuckthorn-berry-powder",
	  "name": "Sea Buckthorn Berry Powder",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 295,
	  "mrp": 295,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1680.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/08/SBT-Powder-Front.jpg", "https://biosash.com/wp-content/uploads/2025/08/01.jpg", "https://biosash.com/wp-content/uploads/2025/08/02.jpg", "https://biosash.com/wp-content/uploads/2025/08/03.jpg"],
	  "form": "100 GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-berry-powder/"
	}, {
	  "id": "b1672",
	  "slug": "seabuckthorn-dry-berry",
	  "name": "Sea Buckthorn Dry Berry",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 299,
	  "mrp": 299,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1672.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/08/SBT-Berry-Front.jpg", "https://biosash.com/wp-content/uploads/2025/08/01-2.jpg", "https://biosash.com/wp-content/uploads/2025/08/02-2.jpg", "https://biosash.com/wp-content/uploads/2025/08/03-2.jpg"],
	  "form": "100 GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-dry-berry/"
	}, {
	  "id": "b1661",
	  "slug": "sea-buckthorn-leaves",
	  "name": "Sea Buckthorn Leaves",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 285,
	  "mrp": 285,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1661.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/08/SBT-Leaves-Front.jpg", "https://biosash.com/wp-content/uploads/2025/08/01-1.jpg", "https://biosash.com/wp-content/uploads/2025/08/02-1.jpg", "https://biosash.com/wp-content/uploads/2025/08/03-1.jpg"],
	  "form": "50 GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-leaves/"
	}, {
	  "id": "b333",
	  "slug": "sea-buckthorn-oil-capsule",
	  "name": "Sea Buckthorn Seed Oil Capsule",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 2715,
	  "mrp": 2715,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b333.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Seabuckthorn-Seed-oil.png", "https://biosash.com/wp-content/uploads/2023/10/01-5.jpg", "https://biosash.com/wp-content/uploads/2023/10/02-5.jpg", "https://biosash.com/wp-content/uploads/2023/10/03-5.jpg"],
	  "form": "30 Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-oil-capsule/"
	}, {
	  "id": "b108",
	  "slug": "spirusash-capsule",
	  "name": "Spirusash Capsule",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 712,
	  "mrp": 712,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b108.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Biosash-Spirulina.png"],
	  "form": "60 Capsule",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/spirusash-capsule/"
	}, {
	  "id": "b1426",
	  "slug": "trimfit-tablets",
	  "name": "Trimfit Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1023,
	  "mrp": 1023,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1426.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2022/12/Biosash-Trimfit-Tablets.png"],
	  "form": "60 Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/trimfit-tablets/"
	}, {
	  "id": "b1435",
	  "slug": "urisash-tablets",
	  "name": "Urisash Tablets",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 1078,
	  "mrp": 1078,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1435.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/01/Biosash-Urisash.png"],
	  "form": "60 Tablets",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/urisash-tablets/"
	}, {
	  "id": "b374",
	  "slug": "whegasash-tablets",
	  "name": "Whegasash Capsules",
	  "category": "supplements",
	  "categories": ["supplements", "wellness"],
	  "price": 712,
	  "mrp": 712,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b374.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Biosash-Wheatgrass.png"],
	  "form": "60 Capsules",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/whegasash-tablets/"
	}, {
	  "id": "b139",
	  "slug": "fresh-turmeric-rhizome-juice-with-guggul",
	  "name": "Fresh Turmeric Rhizome Juice With Guggul",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 840,
	  "mrp": 840,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b139.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Fresh-Turmeric-Rhizome-with-Guggul-250-ML.png"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/fresh-turmeric-rhizome-juice-with-guggul/"
	}, {
	  "id": "b151",
	  "slug": "seabuckthorn-bioradiance-juice",
	  "name": "Sea Buckthorn Bioradiance Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1800,
	  "mrp": 1800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b151.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Bioradiance-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-1.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-1.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-1.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-bioradiance-juice/"
	}, {
	  "id": "b1403",
	  "slug": "seabuckthorn-biosip",
	  "name": "Sea Buckthorn Biosip",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 66,
	  "mrp": 66,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1403.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2022/07/Biosip-Drink.png"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-biosip/"
	}, {
	  "id": "b157",
	  "slug": "seabuckthorn-cardiosash-juice",
	  "name": "Sea Buckthorn Cardiosash Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1687,
	  "mrp": 1687,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b157.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Cardiosash-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-2.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-2.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-2.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-cardiosash-juice/"
	}, {
	  "id": "b141",
	  "slug": "seabuckthorn-detoxo-juice",
	  "name": "Sea Buckthorn Detoxo Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1800,
	  "mrp": 1800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b141.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Detoxo-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-3.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-3.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-3.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-detoxo-juice/"
	}, {
	  "id": "b115",
	  "slug": "seabuckthorn-diabo-juice",
	  "name": "Sea Buckthorn Diabo Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 800,
	  "mrp": 800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b115.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Sea-Buckthorn-Diabo-Juice.png", "https://biosash.com/wp-content/uploads/2023/10/01.jpg", "https://biosash.com/wp-content/uploads/2023/10/02.jpg", "https://biosash.com/wp-content/uploads/2023/10/03.jpg"],
	  "form": "250 ml",
	  "variants": [{
	    "id": "v0",
	    "label": "250 ml"
	  }, {
	    "id": "v1",
	    "label": "750 ml"
	  }],
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-diabo-juice/"
	}, {
	  "id": "b147",
	  "slug": "seabuckthorn-digestosash-juice",
	  "name": "Sea Buckthorn Digestosash Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1800,
	  "mrp": 1800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b147.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Digestosash.png", "https://biosash.com/wp-content/uploads/2020/10/01-33.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-33.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-33.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-digestosash-juice/"
	}, {
	  "id": "b119",
	  "slug": "seabuckthorn-empower-juice",
	  "name": "Sea Buckthorn Empower Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 800,
	  "mrp": 800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b119.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Sea-Buckthorn-Empower-Juice.png", "https://biosash.com/wp-content/uploads/2023/10/01-1.jpg", "https://biosash.com/wp-content/uploads/2023/10/02-1.jpg", "https://biosash.com/wp-content/uploads/2023/10/03-1.jpg"],
	  "form": "250 ml",
	  "variants": [{
	    "id": "v0",
	    "label": "250 ml"
	  }, {
	    "id": "v1",
	    "label": "750 ml"
	  }],
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-empower-juice/"
	}, {
	  "id": "b159",
	  "slug": "seabuckthorn-empower-x-juice",
	  "name": "Sea Buckthorn Empower-X Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1687,
	  "mrp": 1687,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b159.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Empower-x-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-4.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-4.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-4.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-empower-x-juice/"
	}, {
	  "id": "b153",
	  "slug": "seabuckthorn-femsash-juice",
	  "name": "Sea Buckthorn Femsash Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1800,
	  "mrp": 1800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b153.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Femsash-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-5.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-5.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-5.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-femsash-juice/"
	}, {
	  "id": "b145",
	  "slug": "seabuckthorn-ferrosash-juice",
	  "name": "Sea Buckthorn Ferrosash Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1800,
	  "mrp": 1800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b145.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Ferrosash-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-6.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-6.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-6.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-ferrosash-juice/"
	}, {
	  "id": "b143",
	  "slug": "seabuckthorn-giloysash-juice",
	  "name": "Sea Buckthorn Giloysash Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1687,
	  "mrp": 1687,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b143.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Giloysash-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-7.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-7.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-7.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-giloysash-juice/"
	}, {
	  "id": "b114",
	  "slug": "seabuckthorn-immunosash-juice",
	  "name": "Sea Buckthorn Immunosash Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1800,
	  "mrp": 1800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b114.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Immunosash.png", "https://biosash.com/wp-content/uploads/2020/10/01-10.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-10.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-10.jpg"],
	  "form": "250 ml",
	  "variants": [{
	    "id": "v0",
	    "label": "250 ml"
	  }, {
	    "id": "v1",
	    "label": "750 ml"
	  }],
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-immunosash-juice/"
	}, {
	  "id": "b319",
	  "slug": "sea-buckthorn-jam",
	  "name": "Sea Buckthorn Jam",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 370,
	  "mrp": 370,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b319.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Jam.png"],
	  "form": "400g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-jam/"
	}, {
	  "id": "b82",
	  "slug": "biosash-sea-buckthorn-juice",
	  "name": "Sea Buckthorn Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 800,
	  "mrp": 800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b82.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Seabuckthorn.png", "https://biosash.com/wp-content/uploads/2025/11/01.jpg", "https://biosash.com/wp-content/uploads/2025/11/02.jpg", "https://biosash.com/wp-content/uploads/2025/11/03.jpg"],
	  "form": "250 ml",
	  "variants": [{
	    "id": "v0",
	    "label": "250 ml"
	  }, {
	    "id": "v1",
	    "label": "750 ml"
	  }],
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/biosash-sea-buckthorn-juice/"
	}, {
	  "id": "b1395",
	  "slug": "seabuckthorn-juice-with-moringa",
	  "name": "Sea Buckthorn Juice With Moringa",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 800,
	  "mrp": 800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1395.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2022/06/Sbt-Moringa-Juice.png", "https://biosash.com/wp-content/uploads/2022/06/01.jpg", "https://biosash.com/wp-content/uploads/2022/06/02.jpg", "https://biosash.com/wp-content/uploads/2022/06/03.jpg"],
	  "form": "250 ml",
	  "variants": [{
	    "id": "v0",
	    "label": "250 ml"
	  }, {
	    "id": "v1",
	    "label": "750 ml"
	  }],
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-juice-with-moringa/"
	}, {
	  "id": "b155",
	  "slug": "seabuckthorn-livosash-juice",
	  "name": "Sea Buckthorn Livosash Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1800,
	  "mrp": 1800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b155.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Livosash-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-8.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-8.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-8.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-livosash-juice/"
	}, {
	  "id": "b149",
	  "slug": "seabuckthorn-memorysash-juice",
	  "name": "Sea Buckthorn Memorysash Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1800,
	  "mrp": 1800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b149.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Memorysash-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01-9.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-9.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-9.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-memorysash-juice/"
	}, {
	  "id": "b161",
	  "slug": "seabuckthorn-stressaid-juice",
	  "name": "Sea Buckthorn Stressaid Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1687,
	  "mrp": 1687,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b161.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-buckthorn-Stressaid-Juice.png", "https://biosash.com/wp-content/uploads/2020/10/01.jpg", "https://biosash.com/wp-content/uploads/2020/10/02.jpg", "https://biosash.com/wp-content/uploads/2020/10/03.jpg"],
	  "form": "250ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-stressaid-juice/"
	}, {
	  "id": "b117",
	  "slug": "seabuckthorn-trimfit-juice",
	  "name": "Sea Buckthorn Trimfit Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 800,
	  "mrp": 800,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b117.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Sea-Buckthorn-Trimfit-Juice-1.png", "https://biosash.com/wp-content/uploads/2023/10/01-2.jpg", "https://biosash.com/wp-content/uploads/2023/10/02-2.jpg", "https://biosash.com/wp-content/uploads/2023/10/03-2.jpg"],
	  "form": "250 ml",
	  "variants": [{
	    "id": "v0",
	    "label": "250 ml"
	  }, {
	    "id": "v1",
	    "label": "750 ml"
	  }],
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-trimfit-juice/"
	}, {
	  "id": "b122",
	  "slug": "seabuckthorn-with-turmeric-oil",
	  "name": "Sea Buckthorn With Turmeric Oil",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 850,
	  "mrp": 850,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b122.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Sea-Buckthorn-with-Turmeric-Oil-1.png", "https://biosash.com/wp-content/uploads/2023/10/01-3.jpg", "https://biosash.com/wp-content/uploads/2023/10/02-3.jpg", "https://biosash.com/wp-content/uploads/2023/10/03-3.jpg"],
	  "form": "250 ml",
	  "variants": [{
	    "id": "v0",
	    "label": "250 ml"
	  }, {
	    "id": "v1",
	    "label": "750 ml"
	  }],
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-with-turmeric-oil/"
	}, {
	  "id": "b1280",
	  "slug": "seabuck-tea-2",
	  "name": "Seabuck Tea",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1280.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2021/04/Biosash-Seabuck-Tea.png"],
	  "form": "250g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuck-tea-2/"
	}, {
	  "id": "b1792",
	  "slug": "wellsash-capsules-60-capsules",
	  "name": "Wellsash Capsules (60 Capsules)",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1312,
	  "mrp": 1312,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1792.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Wellsash-Capsule.png"],
	  "form": "60 CAPSULES",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/wellsash-capsules-60-capsules/"
	}, {
	  "id": "b353",
	  "slug": "wellsash-sea-buckthorn-juice",
	  "name": "Wellsash Sea Buckthorn Juice",
	  "category": "juices-drinks",
	  "categories": ["juices-drinks", "wellness"],
	  "price": 1585,
	  "mrp": 1585,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b353.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Wellsach.png", "https://biosash.com/wp-content/uploads/2020/10/01-41.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-41.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-41.jpg"],
	  "form": "250 ml",
	  "variants": [{
	    "id": "v0",
	    "label": "250 ml"
	  }, {
	    "id": "v1",
	    "label": "750 ml"
	  }],
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/wellsash-sea-buckthorn-juice/"
	}, {
	  "id": "b169",
	  "slug": "aloe-vera-protein-conditioner",
	  "name": "Aloe Vera Protein Conditioner",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 199,
	  "mrp": 199,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b169.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-Aelo-Vera-Protein-Conditioner.png"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/aloe-vera-protein-conditioner/"
	}, {
	  "id": "b175",
	  "slug": "aloe-vera-protein-shampoo",
	  "name": "Aloe Vera Protein Shampoo",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 299,
	  "mrp": 299,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b175.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/ALOEVERA-PROTEIN-SHAMPOO.png", "https://biosash.com/wp-content/uploads/2020/10/01-29.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-29.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-29.jpg"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/aloe-vera-protein-shampoo/"
	}, {
	  "id": "b179",
	  "slug": "avocado-shampoo",
	  "name": "Avocado Shampoo",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 175,
	  "mrp": 175,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b179.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Avocado.png"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/avocado-shampoo/"
	}, {
	  "id": "b2708",
	  "slug": "hair-oil-with-biotin",
	  "name": "Hair Oil with Biotin",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 375,
	  "mrp": 375,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2708.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/01-11.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-11.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-11.jpg", "https://biosash.com/wp-content/uploads/2026/08/04-11.jpg"],
	  "form": "50 ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/hair-oil-with-biotin/"
	}, {
	  "id": "b205",
	  "slug": "hair-serum",
	  "name": "Hair Serum",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 249,
	  "mrp": 249,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b205.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-HAIR-SERUM.png", "https://biosash.com/wp-content/uploads/2020/10/01-20.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-20.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-20.jpg"],
	  "form": "50ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/hair-serum/"
	}, {
	  "id": "b2700",
	  "slug": "hair-serum-with-squalene",
	  "name": "Hair Serum with Squalene",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 786,
	  "mrp": 786,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2700.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/01-3.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-3.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-3.jpg", "https://biosash.com/wp-content/uploads/2026/08/04-3.jpg"],
	  "form": "50 ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/hair-serum-with-squalene/"
	}, {
	  "id": "b2699",
	  "slug": "hair-and-scalp-serum",
	  "name": "Hair and Scalp Serum",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 786,
	  "mrp": 786,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2699.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/01-2.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-2.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-2.jpg", "https://biosash.com/wp-content/uploads/2026/08/04-2.jpg"],
	  "form": "50 ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/hair-and-scalp-serum/"
	}, {
	  "id": "b1833",
	  "slug": "milk-chocolate-cream-detangle-shampoo",
	  "name": "Milk Chocolate Cream Detangle Shampoo",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 350,
	  "mrp": 350,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1833.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Detangle-shampoo-scaled.png"],
	  "form": "200ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/milk-chocolate-cream-detangle-shampoo/"
	}, {
	  "id": "b382",
	  "slug": "natural-sea-buckthorn-hair-conditioner",
	  "name": "Natural Sea Buckthorn Hair Conditioner",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 249,
	  "mrp": 249,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b382.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Natural-Seab-buckthorn-Conditionar.png"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-sea-buckthorn-hair-conditioner/"
	}, {
	  "id": "b317",
	  "slug": "sea-buckthorn-hair-oil",
	  "name": "Sea Buckthorn Hair Oil",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 399,
	  "mrp": 399,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b317.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-Sea-Buckthorn-Hair-Oil.png", "https://biosash.com/wp-content/uploads/2020/10/01-23.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-23.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-23.jpg"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-hair-oil/"
	}, {
	  "id": "b337",
	  "slug": "sea-buckthorn-shampoo",
	  "name": "Sea Buckthorn Shampoo",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 240,
	  "mrp": 240,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b337.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/SBT-SHAMPOO.png", "https://biosash.com/wp-content/uploads/2020/10/01-39.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-39.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-39.jpg"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-shampoo/"
	}, {
	  "id": "b342",
	  "slug": "sesame-hair-oil",
	  "name": "Sesame Hair Oil",
	  "category": "hair-care",
	  "categories": ["hair-care"],
	  "price": 199,
	  "mrp": 199,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b342.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sesame-Hair-Oil.png", "https://biosash.com/wp-content/uploads/2020/10/01-25.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-25.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-25.jpg"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sesame-hair-oil/"
	}, {
	  "id": "b173",
	  "slug": "aloe-vera-and-neem-face-wash",
	  "name": "Aloe Vera & Neem Face Wash",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b173.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Aloe-Vera-Neem-face-Wash.png"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/aloe-vera-and-neem-face-wash/"
	}, {
	  "id": "b1795",
	  "slug": "coconut-natural-face-wash",
	  "name": "Coconut Natural Face Wash",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1795.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Coconut-Face-Wash.png", "https://biosash.com/wp-content/uploads/2025/10/01-1.jpg", "https://biosash.com/wp-content/uploads/2025/10/02-1.jpg", "https://biosash.com/wp-content/uploads/2025/10/03-1.jpg"],
	  "form": "100ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/coconut-natural-face-wash/"
	}, {
	  "id": "b2702",
	  "slug": "face-neck-massage-gel",
	  "name": "Face & Neck Massage Gel",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 375,
	  "mrp": 375,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2702.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/07-5.jpg", "https://biosash.com/wp-content/uploads/2026/08/01-5.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-5.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-5.jpg"],
	  "form": "50 GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/face-neck-massage-gel/"
	}, {
	  "id": "b2703",
	  "slug": "facial-moisturising-lotion",
	  "name": "Facial Moisturising Lotion",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 630,
	  "mrp": 630,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2703.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/01-6.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-6.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-6.jpg", "https://biosash.com/wp-content/uploads/2026/08/04-6.jpg"],
	  "form": "50 ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/facial-moisturising-lotion/"
	}, {
	  "id": "b397",
	  "slug": "lemon-face-gel",
	  "name": "Lemon Face Gel",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b397.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/lemon-face-gel.png", "https://biosash.com/wp-content/uploads/2020/10/01-11.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-11.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-11.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/lemon-face-gel/"
	}, {
	  "id": "b395",
	  "slug": "luxury-night-cream",
	  "name": "Luxury Night Cream",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 750,
	  "mrp": 750,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b395.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Luxury-Night.png", "https://biosash.com/wp-content/uploads/2020/10/01-12.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-12.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-12.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/luxury-night-cream/"
	}, {
	  "id": "b1831",
	  "slug": "natural-seabuckthorn-face-scrub",
	  "name": "Natural Sea Buckthorn Face Scrub",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 540,
	  "mrp": 540,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1831.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Natural-Sea-buckthorn-Face-Scrub.png", "https://biosash.com/wp-content/uploads/2025/10/01-5.jpg", "https://biosash.com/wp-content/uploads/2025/10/02-5.jpg", "https://biosash.com/wp-content/uploads/2025/10/03-5.jpg"],
	  "form": "50GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-seabuckthorn-face-scrub/"
	}, {
	  "id": "b300",
	  "slug": "sea-buckthorn-massage-cream",
	  "name": "Natural Sea Buckthorn Massage Cream",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 599,
	  "mrp": 599,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b300.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/natural-sea-bkt-massag-cream.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-massage-cream/"
	}, {
	  "id": "b1825",
	  "slug": "natural-seabuckthorn-night-cream",
	  "name": "Natural Sea Buckthorn Night Cream",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 1150,
	  "mrp": 1150,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1825.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Natural-Sea-buckthorn-Night-Cream.png", "https://biosash.com/wp-content/uploads/2025/10/01-3.jpg", "https://biosash.com/wp-content/uploads/2025/10/02-3.jpg", "https://biosash.com/wp-content/uploads/2025/10/03-3.jpg"],
	  "form": "50GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-seabuckthorn-night-cream/"
	}, {
	  "id": "b1828",
	  "slug": "natural-seabuckthorn-nourishing-cream",
	  "name": "Natural Sea Buckthorn Nourishing Cream",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 960,
	  "mrp": 960,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1828.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Natural-Sea-buckthorn-Nourishing-Cream.png", "https://biosash.com/wp-content/uploads/2025/10/01-4.jpg", "https://biosash.com/wp-content/uploads/2025/10/02-4.jpg", "https://biosash.com/wp-content/uploads/2025/10/03-4.jpg"],
	  "form": "50GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-seabuckthorn-nourishing-cream/"
	}, {
	  "id": "b243",
	  "slug": "neem-tulsi-face-wash",
	  "name": "Neem Tulsi Face Wash",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b243.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Neem-Tulsi-Face-Wash.png", "https://biosash.com/wp-content/uploads/2020/10/01-21.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-21.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-21.jpg"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/neem-tulsi-face-wash/"
	}, {
	  "id": "b1149",
	  "slug": "neem-tulsi-skin-toner",
	  "name": "Neem Tulsi Skin Toner",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 375,
	  "mrp": 375,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1149.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/12/Neem-Tulsi-Skin-Tonner.png"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/neem-tulsi-skin-toner/"
	}, {
	  "id": "b394",
	  "slug": "pomegranate-papaya-vitamin-e-face-pack",
	  "name": "Pomegranate Papaya Vitamin E Face Pack",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 325,
	  "mrp": 325,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b394.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Pomegranate.png", "https://biosash.com/wp-content/uploads/2020/10/01-30.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-30.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-30.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/pomegranate-papaya-vitamin-e-face-pack/"
	}, {
	  "id": "b398",
	  "slug": "revitalising-ginseng-face-pack-for-men",
	  "name": "Revitalising Ginseng Face Pack For Men",
	  "category": "skin-care",
	  "categories": ["skin-care", "bath-body"],
	  "price": 325,
	  "mrp": 325,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b398.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Facepack-for-Men.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/revitalising-ginseng-face-pack-for-men/"
	}, {
	  "id": "b399",
	  "slug": "revitalising-ginseng-face-scrub-for-men",
	  "name": "Revitalising Ginseng Face Scrub For Men",
	  "category": "skin-care",
	  "categories": ["skin-care", "bath-body"],
	  "price": 325,
	  "mrp": 325,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b399.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Revitalising-Ginseng.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/revitalising-ginseng-face-scrub-for-men/"
	}, {
	  "id": "b1152",
	  "slug": "rose-water",
	  "name": "Rose Water",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 324,
	  "mrp": 324,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1152.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/12/Rose-Water.png", "https://biosash.com/wp-content/uploads/2020/12/01.jpg", "https://biosash.com/wp-content/uploads/2020/12/02.jpg", "https://biosash.com/wp-content/uploads/2020/12/03.jpg"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/rose-water/"
	}, {
	  "id": "b296",
	  "slug": "anti-wrinkle-serum",
	  "name": "Sea Buckthorn Anti-Wrinkle Serum",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 650,
	  "mrp": 650,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b296.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-Buckthorn-Face-Serum-Anti-Wrinkle-Serum.png", "https://biosash.com/wp-content/uploads/2020/10/01-37.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-37.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-37.jpg"],
	  "form": "30ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/anti-wrinkle-serum/"
	}, {
	  "id": "b310",
	  "slug": "sea-buckthorn-cleanser",
	  "name": "Sea Buckthorn Cleanser",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 175,
	  "mrp": 175,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b310.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-SEA-BUCKTHORN-CLEANSER.png"],
	  "form": "50ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-cleanser/"
	}, {
	  "id": "b298",
	  "slug": "sea-buckthorn-face-pack",
	  "name": "Sea Buckthorn Face Pack",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b298.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Seabuckthorn-face-pack.png", "https://biosash.com/wp-content/uploads/2020/10/01-13.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-13.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-13.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-face-pack/"
	}, {
	  "id": "b313",
	  "slug": "sea-buckthorn-face-scrub",
	  "name": "Sea Buckthorn Face Scrub",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b313.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/face-scrub.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-face-scrub/"
	}, {
	  "id": "b315",
	  "slug": "sea-buckthorn-face-wash",
	  "name": "Sea Buckthorn Face Wash",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 285,
	  "mrp": 285,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b315.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Seabuckthorn-Facewash.png", "https://biosash.com/wp-content/uploads/2020/10/01-22.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-22.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-22.jpg"],
	  "form": "75ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-face-wash/"
	}, {
	  "id": "b1798",
	  "slug": "sea-buckthorn-massage-cream-2",
	  "name": "Sea Buckthorn Massage Cream",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1798.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Seabuckthorn-Massage-Cream.png", "https://biosash.com/wp-content/uploads/2025/10/01-2.jpg", "https://biosash.com/wp-content/uploads/2025/10/02-2.jpg", "https://biosash.com/wp-content/uploads/2025/10/03-2.jpg"],
	  "form": "50GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-massage-cream-2/"
	}, {
	  "id": "b1822",
	  "slug": "sea-buckthorn-natural-under-eye-gel",
	  "name": "Sea Buckthorn Natural Under Eye Gel",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 299,
	  "mrp": 299,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1822.jpeg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/sea-buckthorn-natural-under-eye-gel.jpeg"],
	  "form": "25 Grams",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-natural-under-eye-gel/"
	}, {
	  "id": "b325",
	  "slug": "sea-buckthorn-nourishing-cream",
	  "name": "Sea Buckthorn Nourishing Cream",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b325.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Seabuckthorn-Nourishing.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-nourishing-cream/"
	}, {
	  "id": "b2698",
	  "slug": "seabuckthorn-face-serum",
	  "name": "Seabuckthorn Face Serum",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 630,
	  "mrp": 630,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2698.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/07-1.jpg", "https://biosash.com/wp-content/uploads/2026/08/01-1.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-1.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-1.jpg"],
	  "form": "30 ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-face-serum/"
	}, {
	  "id": "b2707",
	  "slug": "seabuckthorn-skin-toner",
	  "name": "Seabuckthorn Skin Toner",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 499,
	  "mrp": 499,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2707.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/01-10.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-10.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-10.jpg", "https://biosash.com/wp-content/uploads/2026/08/04-10.jpg"],
	  "form": "200 ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-skin-toner/"
	}, {
	  "id": "b302",
	  "slug": "skin-care-with-beauty-berry-sea-buckthorn",
	  "name": "Skin Care With Beauty Berry Sea Buckthorn",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 1500,
	  "mrp": 1500,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b302.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Beauty.png"],
	  "form": "1 Unit",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/skin-care-with-beauty-berry-sea-buckthorn/"
	}, {
	  "id": "b349",
	  "slug": "tulsi-haldi-face-wash",
	  "name": "Tulsi & Haldi Face Wash",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b349.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Tulsi-Haldi-Face-Wash.png", "https://biosash.com/wp-content/uploads/2020/10/01-26.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-26.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-26.jpg"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/tulsi-haldi-face-wash/"
	}, {
	  "id": "b2701",
	  "slug": "under-eye-gel",
	  "name": "Under Eye Gel",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 375,
	  "mrp": 375,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2701.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/07-4.jpg", "https://biosash.com/wp-content/uploads/2026/08/01-4.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-4.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-4.jpg"],
	  "form": "50 GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/under-eye-gel/"
	}, {
	  "id": "b2697",
	  "slug": "vitamin-c-face-serum",
	  "name": "Vitamin C Face Serum",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 630,
	  "mrp": 630,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2697.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/01.jpg", "https://biosash.com/wp-content/uploads/2026/08/02.jpg", "https://biosash.com/wp-content/uploads/2026/08/03.jpg", "https://biosash.com/wp-content/uploads/2026/08/04.jpg"],
	  "form": "30 ML",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/vitamin-c-face-serum/"
	}, {
	  "id": "b259",
	  "slug": "vitamin-e-daily-moisturising-cream",
	  "name": "Vitamin E Daily Moisturising Cream",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b259.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/vitamin-e-daily-cream.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/vitamin-e-daily-moisturising-cream/"
	}, {
	  "id": "b396",
	  "slug": "vitamin-e-skin-hydrating-cream",
	  "name": "Vitamin E Skin Hydrating Cream",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 295,
	  "mrp": 295,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b396.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/vitamin-E-skin-hydrating.png", "https://biosash.com/wp-content/uploads/2020/10/01-27.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-27.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-27.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/vitamin-e-skin-hydrating-cream/"
	}, {
	  "id": "b351",
	  "slug": "vitamin-e-sunscreen-spf-30",
	  "name": "Vitamin E Sunscreen SPF-30",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b351.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/vitamen-E-sunscreem.png", "https://biosash.com/wp-content/uploads/2020/10/01-42.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-42.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-42.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/vitamin-e-sunscreen-spf-30/"
	}, {
	  "id": "b1156",
	  "slug": "vitamin-c-face-cream-de-tan",
	  "name": "Vitamin-C Face Cream (Detan)",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 599,
	  "mrp": 599,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1156.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/12/vitamin-c-face-cream.png", "https://biosash.com/wp-content/uploads/2020/12/01-2.jpg", "https://biosash.com/wp-content/uploads/2020/12/02-2.jpg", "https://biosash.com/wp-content/uploads/2020/12/03-2.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/vitamin-c-face-cream-de-tan/"
	}, {
	  "id": "b1154",
	  "slug": "vitamin-c-face-pack-de-tan",
	  "name": "Vitamin-C Face Pack (Detan)",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 499,
	  "mrp": 499,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1154.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/12/vitamin-c-face-pack.png", "https://biosash.com/wp-content/uploads/2020/12/01-3.jpg", "https://biosash.com/wp-content/uploads/2020/12/02-3.jpg", "https://biosash.com/wp-content/uploads/2020/12/03-3.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/vitamin-c-face-pack-de-tan/"
	}, {
	  "id": "b1158",
	  "slug": "vitamin-c-peel-off-face-mask-de-tan",
	  "name": "Vitamin-C Peel Off Face Mask (Detan)",
	  "category": "skin-care",
	  "categories": ["skin-care"],
	  "price": 499,
	  "mrp": 499,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1158.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/12/Vitamin-C.png", "https://biosash.com/wp-content/uploads/2020/12/01-1.jpg", "https://biosash.com/wp-content/uploads/2020/12/02-1.jpg", "https://biosash.com/wp-content/uploads/2020/12/03-1.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/vitamin-c-peel-off-face-mask-de-tan/"
	}, {
	  "id": "b389",
	  "slug": "bees-wax-honey-bathing-bar",
	  "name": "Bees Wax & Honey Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 59,
	  "mrp": 59,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b389.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Bees-Wax-And-Honey.png"],
	  "form": "75g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/bees-wax-honey-bathing-bar/"
	}, {
	  "id": "b190",
	  "slug": "body-wash-men",
	  "name": "Body Wash Men",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 375,
	  "mrp": 375,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b190.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Body-Wash-Men.png"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/body-wash-men/"
	}, {
	  "id": "b2706",
	  "slug": "charcoal-bathing-bar",
	  "name": "Charcoal Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 249,
	  "mrp": 249,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2706.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/07-9.jpg", "https://biosash.com/wp-content/uploads/2026/08/01-9.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-9.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-9.jpg"],
	  "form": "150 GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/charcoal-bathing-bar/"
	}, {
	  "id": "b1461",
	  "slug": "chocolate-bathing-bar-soap",
	  "name": "Chocolate Bathing Bar (Soap)",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 39,
	  "mrp": 39,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1461.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/05/Choclate-Soap.png"],
	  "form": "50gm",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/chocolate-bathing-bar-soap/"
	}, {
	  "id": "b193",
	  "slug": "citrus-lemon-body-wash",
	  "name": "Citrus Lemon Body Wash",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 240,
	  "mrp": 240,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b193.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Citrus-Lemon-Body-Wash.png", "https://biosash.com/wp-content/uploads/2020/10/01-18.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-18.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-18.jpg"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/citrus-lemon-body-wash/"
	}, {
	  "id": "b1523",
	  "slug": "geranium-after-bath-oil",
	  "name": "Geranium After Bath Oil",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 295,
	  "mrp": 295,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1523.webp",
	  "gallery": ["https://biosash.com/wp-content/uploads/2024/04/GERANIUM-AFTER-BATH-OI.webp"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/geranium-after-bath-oil/"
	}, {
	  "id": "b1463",
	  "slug": "grape-fruit-bathing-bar-soap",
	  "name": "Grape Fruit Bathing Bar (Soap)",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 39,
	  "mrp": 39,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1463.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/05/Grape-Fruit.png"],
	  "form": "50gm",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/grape-fruit-bathing-bar-soap/"
	}, {
	  "id": "b1839",
	  "slug": "green-apple-bathing-bar-soap",
	  "name": "Green Apple Bathing Bar (Soap)",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 39,
	  "mrp": 39,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1839.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Biosash-Green-Apple-Bathing-Bar-scaled.png"],
	  "form": "50GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/green-apple-bathing-bar-soap/"
	}, {
	  "id": "b391",
	  "slug": "herbal-scrub-bathing-bar",
	  "name": "Herbal Scrub Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 75,
	  "mrp": 75,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b391.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Herbal.png"],
	  "form": "75g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/herbal-scrub-bathing-bar/"
	}, {
	  "id": "b209",
	  "slug": "honey-almond-bathing-bar",
	  "name": "Honey & Almond Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 119,
	  "mrp": 119,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b209.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Honey-And-Almonds-scaled.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/honey-almond-bathing-bar/"
	}, {
	  "id": "b211",
	  "slug": "honey-foot-butter-with-bees-wax",
	  "name": "Honey Foot Butter With Bees Wax",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 210,
	  "mrp": 210,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b211.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Honey-Foot-butter-1.png", "https://biosash.com/wp-content/uploads/2020/10/01-32.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-32.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-32.jpg"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/honey-foot-butter-with-bees-wax/"
	}, {
	  "id": "b213",
	  "slug": "hydrating-sea-mineral-body-wash",
	  "name": "Hydrating Sea Mineral Body Wash",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 295,
	  "mrp": 295,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b213.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sea-minral-Body-Wash.png", "https://biosash.com/wp-content/uploads/2020/10/01-38.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-38.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-38.jpg"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/hydrating-sea-mineral-body-wash/"
	}, {
	  "id": "b390",
	  "slug": "jasmine-bathing-bar",
	  "name": "Jasmine Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 75,
	  "mrp": 75,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b390.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Jasmine.png"],
	  "form": "75g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/jasmine-bathing-bar/"
	}, {
	  "id": "b2705",
	  "slug": "kakadu-bathing-bar-soap",
	  "name": "Kakadu Bathing Bar Soap",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 249,
	  "mrp": 249,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2705.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/07-8.jpg", "https://biosash.com/wp-content/uploads/2026/08/01-8.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-8.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-8.jpg"],
	  "form": "150 GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/kakadu-bathing-bar-soap/"
	}, {
	  "id": "b388",
	  "slug": "lavender-bathing-bar",
	  "name": "Lavender Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 75,
	  "mrp": 75,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b388.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Lavender.png"],
	  "form": "75g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/lavender-bathing-bar/"
	}, {
	  "id": "b1842",
	  "slug": "lemon-bathing-bar-soap",
	  "name": "Lemon Bathing Bar (Soap)",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 39,
	  "mrp": 39,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1842.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/10/Lemon.png"],
	  "form": "50GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/lemon-bathing-bar-soap/"
	}, {
	  "id": "b215",
	  "slug": "lemongrass-bathing-bar",
	  "name": "Lemongrass Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 99,
	  "mrp": 99,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b215.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Lemon-Grass.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/lemongrass-bathing-bar/"
	}, {
	  "id": "b1465",
	  "slug": "lemongrass-bathing-bar-soap-with-loofah",
	  "name": "Lemongrass Bathing Bar (Soap) With Loofah",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 93,
	  "mrp": 93,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1465.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/05/Lemon-Grass-With-Loofah.png"],
	  "form": "100gm",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/lemongrass-bathing-bar-soap-with-loofah/"
	}, {
	  "id": "b392",
	  "slug": "lemongrass-foot-scrub",
	  "name": "Lemongrass Foot Scrub",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b392.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Lemongrass-Foot-Scrub-5.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/lemongrass-foot-scrub/"
	}, {
	  "id": "b1467",
	  "slug": "litchi-bathing-bar-soap",
	  "name": "Litchi Bathing Bar (Soap)",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 39,
	  "mrp": 39,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1467.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/05/Litchi.png"],
	  "form": "50gm",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/litchi-bathing-bar-soap/"
	}, {
	  "id": "b219",
	  "slug": "massage-oil",
	  "name": "Massage Oil",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 375,
	  "mrp": 375,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b219.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-MASSAGE-OIL.png"],
	  "form": "50ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/massage-oil/"
	}, {
	  "id": "b226",
	  "slug": "multani-mitti-bathing-bar",
	  "name": "Multani Mitti Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 99,
	  "mrp": 99,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b226.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Multani-Mitti.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/multani-mitti-bathing-bar/"
	}, {
	  "id": "b383",
	  "slug": "musk-bathing-bar",
	  "name": "Musk Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 119,
	  "mrp": 119,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b383.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Musk.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/musk-bathing-bar/"
	}, {
	  "id": "b1469",
	  "slug": "natural-honey-vanilla-and-beeswax-soap",
	  "name": "Natural Honey Vanilla And Beeswax (Soap)",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 145,
	  "mrp": 145,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1469.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/05/HOney-Valilla.png"],
	  "form": "100gm",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-honey-vanilla-and-beeswax-soap/"
	}, {
	  "id": "b393",
	  "slug": "natural-rosemary-shea-butter-sugar-body-scrub",
	  "name": "Natural Rosemary & Shea Butter Sugar Body Scrub",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 375,
	  "mrp": 375,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b393.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Rosemary-Shea-Butter.png", "https://biosash.com/wp-content/uploads/2020/10/Rosemary-Shea-Butter.png"],
	  "form": "125g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-rosemary-shea-butter-sugar-body-scrub/"
	}, {
	  "id": "b239",
	  "slug": "natural-seabuckthorn-bathing-bar",
	  "name": "Natural Sea Buckthorn Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 145,
	  "mrp": 145,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b239.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/natural-Sea-Buckthorn.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-seabuckthorn-bathing-bar/"
	}, {
	  "id": "b1857",
	  "slug": "natural-seabuckthorn-moisturizing-lotion",
	  "name": "Natural Sea Buckthorn Moisturizing Lotion",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 1150,
	  "mrp": 1150,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1857.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2025/12/Natural-Sea-buckthorn-Lotion.png", "https://biosash.com/wp-content/uploads/2025/12/01.jpg", "https://biosash.com/wp-content/uploads/2025/12/02.jpg", "https://biosash.com/wp-content/uploads/2025/12/03.jpg"],
	  "form": "30g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-seabuckthorn-moisturizing-lotion/"
	}, {
	  "id": "b2704",
	  "slug": "natural-seabuckthorn-bathing-bar-soap",
	  "name": "Natural Seabuckthorn Bathing Bar (Soap)",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 249,
	  "mrp": 249,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b2704.jpg",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/08/07-7.jpg", "https://biosash.com/wp-content/uploads/2026/08/01-7.jpg", "https://biosash.com/wp-content/uploads/2026/08/02-7.jpg", "https://biosash.com/wp-content/uploads/2026/08/03-7.jpg"],
	  "form": "150 GMS",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/natural-seabuckthorn-bathing-bar-soap/"
	}, {
	  "id": "b241",
	  "slug": "neem-tulsi-bath",
	  "name": "Neem & Tulsi Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 119,
	  "mrp": 119,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b241.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Neem-And-Tulsi.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/neem-tulsi-bath/"
	}, {
	  "id": "b1882",
	  "slug": "peach-bathing-bar-soap",
	  "name": "Peach Bathing Bar (Soap)",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 39,
	  "mrp": 39,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1882.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2026/04/PeachSoap.png"],
	  "form": "50g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/peach-bathing-bar-soap/"
	}, {
	  "id": "b385",
	  "slug": "peppermint-bathing-bar",
	  "name": "Peppermint Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 59,
	  "mrp": 59,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b385.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/paper-Mint.png"],
	  "form": "75g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/peppermint-bathing-bar/"
	}, {
	  "id": "b1471",
	  "slug": "rose-and-geranium-bathing-bar-soap-with-loofah",
	  "name": "Rose And Geranium Bathing Bar (Soap) With Loofah",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 119,
	  "mrp": 119,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1471.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2023/05/Rose-And-Gerenium.png"],
	  "form": "100gm",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/rose-and-geranium-bathing-bar-soap-with-loofah/"
	}, {
	  "id": "b247",
	  "slug": "rose-bathing-bar",
	  "name": "Rose Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 119,
	  "mrp": 119,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b247.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Rose.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/rose-bathing-bar/"
	}, {
	  "id": "b306",
	  "slug": "sandal-turmeric-bath-soap",
	  "name": "Sandal & Turmeric Bath Soap",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 119,
	  "mrp": 119,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b306.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Sandel-And-Turmeric.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sandal-turmeric-bath-soap/"
	}, {
	  "id": "b257",
	  "slug": "seabuckthorn-body-lotion",
	  "name": "Sea Buckthorn Body Lotion",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 425,
	  "mrp": 425,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b257.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-Sea-Buckthron-Body-Lotion.png", "https://biosash.com/wp-content/uploads/2020/10/01-43.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-43.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-43.jpg"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-body-lotion/"
	}, {
	  "id": "b254",
	  "slug": "seabuckthorn-natural-after-bath-oil",
	  "name": "Sea Buckthorn Natural After Bath Oil",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 595,
	  "mrp": 595,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b254.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-SEABUCKTHORN-NATURAL-AFTER-BATH-OIL.png", "https://biosash.com/wp-content/uploads/2020/10/01-36.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-36.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-36.jpg"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-natural-after-bath-oil/"
	}, {
	  "id": "b321",
	  "slug": "seabuckthorn-natural-massage-oil",
	  "name": "Sea Buckthorn Natural Massage Oil",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 595,
	  "mrp": 595,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b321.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-SEABUCKTHORN-NATURAL-MASSAGE-OIL.png", "https://biosash.com/wp-content/uploads/2020/10/01-24.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-24.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-24.jpg"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-natural-massage-oil/"
	}, {
	  "id": "b327",
	  "slug": "seabuckthorn-oil",
	  "name": "Sea Buckthorn Oil",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 999,
	  "mrp": 999,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b327.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-SEABUCKTHORN-OIL.png"],
	  "form": "10ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/seabuckthorn-oil/"
	}, {
	  "id": "b335",
	  "slug": "sea-buckthorn-pulp-bathing-bar",
	  "name": "Sea Buckthorn Pulp Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 119,
	  "mrp": 119,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b335.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Seabuckthorn-Bathing-Soap.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/sea-buckthorn-pulp-bathing-bar/"
	}, {
	  "id": "b344",
	  "slug": "strawberry-bathing-bar",
	  "name": "Strawberry Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 119,
	  "mrp": 119,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b344.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Strawberrry.png"],
	  "form": "100g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/strawberry-bathing-bar/"
	}, {
	  "id": "b347",
	  "slug": "strawberry-shower-gel",
	  "name": "Strawberry Shower Gel",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 395,
	  "mrp": 395,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b347.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Strawberry-Shower-Gel.png"],
	  "form": "200ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/strawberry-shower-gel/"
	}, {
	  "id": "b1295",
	  "slug": "talcum-powder",
	  "name": "Talcum Powder",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 295,
	  "mrp": 295,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b1295.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2021/04/Biosash-Talcum-Powder.png", "https://biosash.com/wp-content/uploads/2021/04/01.jpg", "https://biosash.com/wp-content/uploads/2021/04/02.jpg", "https://biosash.com/wp-content/uploads/2021/04/03.jpg"],
	  "form": "200g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/talcum-powder/"
	}, {
	  "id": "b386",
	  "slug": "tea-tree-bathing-bar",
	  "name": "Tea Tree Bathing Bar",
	  "category": "bath-body",
	  "categories": ["bath-body"],
	  "price": 59,
	  "mrp": 59,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b386.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Tea-Tree.png"],
	  "form": "75g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/tea-tree-bathing-bar/"
	}, {
	  "id": "b195",
	  "slug": "dentosash",
	  "name": "Dentosash Toothgel",
	  "category": "personal-care",
	  "categories": ["personal-care"],
	  "price": 220,
	  "mrp": 220,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b195.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/10/Dentosash.png", "https://biosash.com/wp-content/uploads/2020/10/01-19.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-19.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-19.jpg"],
	  "form": "150g",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/dentosash/"
	}, {
	  "id": "b217",
	  "slug": "liquid-wash-intimate-women",
	  "name": "Liquid Wash Intimate Women",
	  "category": "personal-care",
	  "categories": ["personal-care"],
	  "price": 225,
	  "mrp": 225,
	  "onSale": false,
	  "discountPct": 0,
	  "image": "/img/b217.png",
	  "gallery": ["https://biosash.com/wp-content/uploads/2020/09/Biosash-LIQUID-WASH-INTIMATE-WOMEN.png", "https://biosash.com/wp-content/uploads/2020/10/01-40.jpg", "https://biosash.com/wp-content/uploads/2020/10/02-40.jpg", "https://biosash.com/wp-content/uploads/2020/10/03-40.jpg"],
	  "form": "100ml",
	  "variants": null,
	  "rating": 0,
	  "reviewCount": 0,
	  "inStock": true,
	  "permalink": "https://biosash.com/product/liquid-wash-intimate-women/"
	}];

	// ============================================================
	// CATALOG — normalized from the real Biosash data (biosash.js).
	// UI components read only from here; the same exported API used by
	// the placeholder catalog is preserved, so every page keeps working.
	// Facts only (name, price, size, category, image). No fabricated
	// ratings, reviews, discounts or "bestseller" flags.
	// ============================================================

	// Sora Life promotional discount tiers. The ORIGINAL price is the verified
	// official Biosash price; the discount is a Sora Life promo applied on top.
	// Assignment is deterministic per product (stable across reloads/pages).
	const DISCOUNT_TIERS = [10, 15, 18, 20];
	const products = BIOSASH_PRODUCTS.map((p, i) => {
	  // Verified official Biosash price = ORIGINAL PRICE / MRP. Never invented.
	  const originalPrice = Number(p.price) > 0 ? Number(p.price) : 0;
	  const priceVerified = originalPrice > 0;
	  const idNum = parseInt(String(p.id).replace(/\D/g, ''), 10) || i;
	  const discountPercent = priceVerified ? DISCOUNT_TIERS[idNum % DISCOUNT_TIERS.length] : 0;
	  // salePrice = originalPrice × (1 − discount/100), rounded to whole rupees.
	  const salePrice = priceVerified ? Math.round(originalPrice * (1 - discountPercent / 100)) : 0;
	  const badges = [];
	  if (discountPercent > 0) badges.push({
	    type: 'sale',
	    label: `${discountPercent}% OFF`
	  });
	  return {
	    id: p.id,
	    slug: p.slug,
	    name: p.name,
	    category: p.category,
	    // primary storefront category
	    categories: p.categories || [p.category],
	    // all storefront categories it belongs to
	    form: p.form || null,
	    // ---- Pricing (single source of truth) ----
	    originalPrice,
	    // verified official Biosash price (MRP)
	    discountPercent,
	    // Sora Life promo tier (10/15/18/20)
	    salePrice,
	    // computed selling price
	    priceVerified,
	    price: priceVerified ? salePrice : originalPrice,
	    // "now" price used everywhere
	    mrp: originalPrice,
	    // struck-through original
	    discountPct: discountPercent,
	    // used by PriceTag/badges
	    currency: '₹',
	    onSale: discountPercent > 0,
	    image: p.image,
	    // local official image
	    gallery: p.gallery && p.gallery.length ? p.gallery : [],
	    permalink: p.permalink,
	    rating: p.reviewCount > 0 ? p.rating : 0,
	    reviewCount: p.reviewCount || 0,
	    reviews: [],
	    // none available from source — not fabricated
	    badges,
	    flags: [],
	    variants: p.variants || null,
	    stock: p.inStock ? 40 : 0,
	    // Optional editorial fields (empty — not invented). Rendered only if present.
	    shortDescription: `${categoryBySlug[p.category]?.name || 'Sea buckthorn'}${p.form ? ' · ' + p.form : ''}`,
	    description: '',
	    ingredients: [],
	    benefits: [],
	    usage: '',
	    isNew: false,
	    isBestseller: false,
	    isFeatured: false
	  };
	});

	// relatedIds — same category first, then fill from the rest
	const byCat = {};
	products.forEach(p => {
	  (byCat[p.category] ||= []).push(p.id);
	});
	products.forEach(p => {
	  const same = (byCat[p.category] || []).filter(id => id !== p.id);
	  const others = products.filter(o => o.category !== p.category).map(o => o.id);
	  p.relatedIds = [...same, ...others].slice(0, 6);
	});
	const productBySlug = Object.fromEntries(products.map(p => [p.slug, p]));
	const productById = Object.fromEntries(products.map(p => [p.id, p]));

	// Category membership (a product can live in several storefront categories)
	function getByCategory(slug) {
	  return products.filter(p => (p.categories || [p.category]).includes(slug));
	}

	// Curated selections to populate homepage rails. These pick real, in-stock
	// products spread across the catalog — they do NOT tag individual products
	// with unverified "bestseller"/"new" claims.
	function inStock(list) {
	  return list.filter(p => p.stock > 0);
	}
	function getBestsellers(n = 12) {
	  // one strong pick per category, then fill — gives a varied, real selection
	  const picks = [];
	  const used = new Set();
	  for (const c of Object.keys(byCat)) {
	    const first = inStock(getByCategory(c))[0];
	    if (first && !used.has(first.id)) {
	      picks.push(first);
	      used.add(first.id);
	    }
	  }
	  for (const p of inStock(products)) {
	    if (picks.length >= n) break;
	    if (!used.has(p.id)) {
	      picks.push(p);
	      used.add(p.id);
	    }
	  }
	  return picks.slice(0, n);
	}
	function getNewArrivals(n = 8) {
	  // "New in" = most recently added (highest source id) — real ordering, no label
	  return inStock([...products].sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1)))).slice(0, n);
	}
	function getRelated(product) {
	  return (product.relatedIds || []).map(id => productById[id]).filter(Boolean);
	}
	function searchProducts(q) {
	  const t = q.trim().toLowerCase();
	  if (!t) return [];
	  return products.filter(p => p.name.toLowerCase().includes(t) || (categoryBySlug[p.category]?.name || '').toLowerCase().includes(t) || (p.form || '').toLowerCase().includes(t));
	}
	const priceRange = (() => {
	  const prices = products.map(p => p.price);
	  return {
	    min: Math.min(...prices),
	    max: Math.max(...prices)
	  };
	})();

	const StoreCtx = /*#__PURE__*/reactExports.createContext(null);
	const KEY = 'sora.store.v1';
	const initial = {
	  cart: [],
	  wishlist: [],
	  saved: []
	};
	function load() {
	  try {
	    const raw = localStorage.getItem(KEY);
	    if (raw) return {
	      ...initial,
	      ...JSON.parse(raw)
	    };
	  } catch {}
	  return initial;
	}
	function reducer(state, action) {
	  switch (action.type) {
	    case 'ADD':
	      {
	        const {
	          id,
	          qty = 1,
	          variant = null
	        } = action;
	        const key = id + (variant ? '::' + variant : '');
	        const existing = state.cart.find(l => l.key === key);
	        const cart = existing ? state.cart.map(l => l.key === key ? {
	          ...l,
	          qty: l.qty + qty
	        } : l) : [...state.cart, {
	          key,
	          id,
	          variant,
	          qty
	        }];
	        return {
	          ...state,
	          cart
	        };
	      }
	    case 'SET_QTY':
	      {
	        const cart = state.cart.map(l => l.key === action.key ? {
	          ...l,
	          qty: Math.max(1, action.qty)
	        } : l);
	        return {
	          ...state,
	          cart
	        };
	      }
	    case 'REMOVE':
	      return {
	        ...state,
	        cart: state.cart.filter(l => l.key !== action.key)
	      };
	    case 'SAVE_LATER':
	      {
	        const line = state.cart.find(l => l.key === action.key);
	        if (!line) return state;
	        return {
	          ...state,
	          cart: state.cart.filter(l => l.key !== action.key),
	          saved: [...state.saved, line]
	        };
	      }
	    case 'MOVE_TO_CART':
	      {
	        const line = state.saved.find(l => l.key === action.key);
	        if (!line) return state;
	        const existing = state.cart.find(l => l.key === line.key);
	        const cart = existing ? state.cart.map(l => l.key === line.key ? {
	          ...l,
	          qty: l.qty + line.qty
	        } : l) : [...state.cart, line];
	        return {
	          ...state,
	          cart,
	          saved: state.saved.filter(l => l.key !== action.key)
	        };
	      }
	    case 'REMOVE_SAVED':
	      return {
	        ...state,
	        saved: state.saved.filter(l => l.key !== action.key)
	      };
	    case 'TOGGLE_WISH':
	      {
	        const has = state.wishlist.includes(action.id);
	        return {
	          ...state,
	          wishlist: has ? state.wishlist.filter(x => x !== action.id) : [...state.wishlist, action.id]
	        };
	      }
	    case 'CLEAR_CART':
	      return {
	        ...state,
	        cart: []
	      };
	    default:
	      return state;
	  }
	}
	function StoreProvider({
	  children
	}) {
	  const [state, dispatch] = reactExports.useReducer(reducer, undefined, load);
	  const [toasts, setToasts] = reactExports.useState([]);
	  reactExports.useEffect(() => {
	    try {
	      localStorage.setItem(KEY, JSON.stringify(state));
	    } catch {}
	  }, [state]);
	  const toast = reactExports.useCallback((message, opts = {}) => {
	    const id = Math.random().toString(36).slice(2);
	    setToasts(t => [...t, {
	      id,
	      message,
	      ...opts
	    }]);
	    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts.duration || 2600);
	  }, []);
	  const addToCart = reactExports.useCallback((product, qty = 1, variant = null) => {
	    dispatch({
	      type: 'ADD',
	      id: product.id,
	      qty,
	      variant
	    });
	    toast(`Added to cart`, {
	      product: product.id,
	      kind: 'cart'
	    });
	  }, [toast]);
	  const toggleWish = reactExports.useCallback(product => {
	    dispatch({
	      type: 'TOGGLE_WISH',
	      id: product.id
	    });
	    const wasIn = state.wishlist.includes(product.id);
	    toast(wasIn ? 'Removed from wishlist' : 'Saved to wishlist', {
	      kind: 'wish'
	    });
	  }, [state.wishlist, toast]);
	  const cartDetailed = reactExports.useMemo(() => state.cart.map(l => ({
	    ...l,
	    product: productById[l.id]
	  })).filter(l => l.product), [state.cart]);
	  const savedDetailed = reactExports.useMemo(() => state.saved.map(l => ({
	    ...l,
	    product: productById[l.id]
	  })).filter(l => l.product), [state.saved]);
	  const cartCount = reactExports.useMemo(() => state.cart.reduce((s, l) => s + l.qty, 0), [state.cart]);
	  const subtotal = reactExports.useMemo(() => cartDetailed.reduce((s, l) => s + l.product.price * l.qty, 0), [cartDetailed]);
	  const savings = reactExports.useMemo(() => cartDetailed.reduce((s, l) => s + Math.max(0, (l.product.mrp || l.product.price) - l.product.price) * l.qty, 0), [cartDetailed]);
	  const value = {
	    ...state,
	    dispatch,
	    toasts,
	    toast,
	    addToCart,
	    toggleWish,
	    isWished: id => state.wishlist.includes(id),
	    cartDetailed,
	    savedDetailed,
	    cartCount,
	    wishCount: state.wishlist.length,
	    subtotal,
	    savings
	  };
	  return /*#__PURE__*/jsxRuntimeExports.jsx(StoreCtx.Provider, {
	    value: value,
	    children: children
	  });
	}
	function useStore() {
	  const ctx = reactExports.useContext(StoreCtx);
	  if (!ctx) throw new Error('useStore must be used within StoreProvider');
	  return ctx;
	}

	function money(n, currency = '₹') {
	  return currency + Number(n).toLocaleString('en-IN');
	}

	const NOTICES = ['FREE SHIPPING on orders above ₹699', 'COD Available', '100% Authentic Biosash Products'];
	function Header() {
	  const {
	    cartCount,
	    wishCount
	  } = useStore();
	  const [drawer, setDrawer] = reactExports.useState(false);
	  const [q, setQ] = reactExports.useState('');
	  const [focused, setFocused] = reactExports.useState(false);
	  const navigate = useNavigate();
	  const location = useLocation();
	  const boxRef = reactExports.useRef(null);
	  reactExports.useEffect(() => {
	    setDrawer(false);
	    setFocused(false);
	  }, [location.pathname]);
	  reactExports.useEffect(() => {
	    document.body.style.overflow = drawer ? 'hidden' : '';
	    return () => {
	      document.body.style.overflow = '';
	    };
	  }, [drawer]);
	  reactExports.useEffect(() => {
	    const onDoc = e => {
	      if (boxRef.current && !boxRef.current.contains(e.target)) setFocused(false);
	    };
	    document.addEventListener('mousedown', onDoc);
	    return () => document.removeEventListener('mousedown', onDoc);
	  }, []);
	  const results = q.trim() ? searchProducts(q).slice(0, 6) : [];
	  const submit = e => {
	    e.preventDefault();
	    if (q.trim()) {
	      navigate(`/shop?q=${encodeURIComponent(q.trim())}`);
	      setFocused(false);
	    }
	  };
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "annbar",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container annbar__in",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "annbar__side",
	          "aria-hidden": "true"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "annbar__notices",
	          children: NOTICES.map((n, i) => /*#__PURE__*/jsxRuntimeExports.jsxs(reactExports.Fragment, {
	            children: [i > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "annbar__sep",
	              "aria-hidden": "true"
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	              className: "annbar__notice",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: i === 0 ? 'truck' : i === 1 ? 'card' : 'shield',
	                size: 14
	              }), " ", n]
	            })]
	          }, n))
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "annbar__links",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/account/orders",
	            children: "Track Order"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "annbar__sep",
	            "aria-hidden": "true"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Store Locator"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "annbar__sep",
	            "aria-hidden": "true"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/account",
	            children: "Help & Support"
	          })]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("header", {
	      className: "hdr",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container hdr__in",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "hdr__left",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "iconbtn only-mobile",
	            onClick: () => setDrawer(true),
	            "aria-label": "Open menu",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "menu"
	            })
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Logo, {})]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	          className: "hdr__nav hide-mobile",
	          "aria-label": "Primary",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "hdr__navitem has-mega",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs(NavLink, {
	              to: "/shop",
	              className: "hdr__link",
	              children: ["SHOP ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "chevronDown",
	                size: 14
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "mega",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	                className: "mega__grid",
	                children: categories.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	                  to: `/category/${c.slug}`,
	                  className: "mega__cell",
	                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                    className: "mega__name",
	                    children: c.name
	                  }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                    className: "mega__tag",
	                    children: c.tagline
	                  })]
	                }, c.slug))
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	                to: "/shop",
	                className: "mega__all",
	                children: ["Shop all products ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "arrowRight",
	                  size: 16
	                })]
	              })]
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(NavLink, {
	            to: "/category/wellness",
	            className: "hdr__link",
	            children: "WELLNESS"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(NavLink, {
	            to: "/category/skin-care",
	            className: "hdr__link",
	            children: "SKIN CARE"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(NavLink, {
	            to: "/category/hair-care",
	            className: "hdr__link",
	            children: "HAIR CARE"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(NavLink, {
	            to: "/category/bath-body",
	            className: "hdr__link",
	            children: "BATH & BODY"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(NavLink, {
	            to: "/category/mens-care",
	            className: "hdr__link",
	            children: "MEN'S CARE"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(NavLink, {
	            to: "/shop?sort=bestselling",
	            className: "hdr__link",
	            children: "BESTSELLERS"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(NavLink, {
	            to: "/shop?filter=new",
	            className: "hdr__link",
	            children: "NEW IN"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "hdr__right",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "hdr__search hide-mobile",
	            ref: boxRef,
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("form", {
	              className: "searchbox",
	              onSubmit: submit,
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                placeholder: "Search for products...",
	                value: q,
	                onChange: e => setQ(e.target.value),
	                onFocus: () => setFocused(true),
	                "aria-label": "Search for products"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	                type: "submit",
	                className: "hdr__search-btn",
	                "aria-label": "Search",
	                children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "search",
	                  size: 18
	                })
	              })]
	            }), focused && q.trim() && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	              className: "hdr__suggest",
	              children: results.length ? results.map(p => /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	                to: `/product/${p.slug}`,
	                className: "hdr__suggest-item",
	                onClick: () => setFocused(false),
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                  className: "hdr__suggest-thumb",
	                  children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	                    product: p
	                  })
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                  className: "hdr__suggest-name",
	                  children: p.name
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                  className: "hdr__suggest-price",
	                  children: money(p.price)
	                })]
	              }, p.id)) : /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	                className: "muted",
	                style: {
	                  padding: 14
	                },
	                children: ["No matches for \u201C", q, "\u201D."]
	              })
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "hdr__actions",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "iconbtn only-mobile",
	              onClick: () => navigate('/shop'),
	              "aria-label": "Search",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "search"
	              })
	            }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	              to: "/account",
	              className: "iconbtn hide-mobile",
	              "aria-label": "Account",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "user"
	              })
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	              to: "/wishlist",
	              className: "iconbtn hide-mobile",
	              "aria-label": "Wishlist",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "heart"
	              }), wishCount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "count",
	                children: wishCount
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	              to: "/cart",
	              className: "iconbtn",
	              "aria-label": "Cart",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "bag"
	              }), cartCount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "count",
	                children: cartCount
	              })]
	            })]
	          })]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: `drawer ${drawer ? 'open' : ''}`,
	      "aria-hidden": !drawer,
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "drawer__scrim",
	        onClick: () => setDrawer(false)
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "drawer__panel",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "drawer__top",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Logo, {
	            compact: true,
	            tagline: false
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "iconbtn",
	            onClick: () => setDrawer(false),
	            "aria-label": "Close menu",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "x"
	            })
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
	          className: "searchbox",
	          style: {
	            margin: '0 16px 8px'
	          },
	          onSubmit: submit,
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "search"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	            className: "input",
	            placeholder: "Search for products...",
	            value: q,
	            onChange: e => setQ(e.target.value)
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	          className: "drawer__nav",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/shop",
	            className: "drawer__link",
	            children: "All products"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/shop?sort=bestselling",
	            className: "drawer__link",
	            children: "Bestsellers"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/shop?filter=new",
	            className: "drawer__link",
	            children: "New in"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "drawer__sec",
	            children: "Categories"
	          }), categories.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	            to: `/category/${c.slug}`,
	            className: "drawer__cat",
	            children: [c.name, /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "chevronRight",
	              size: 17
	            })]
	          }, c.slug))]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "drawer__foot",
	          children: /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	            to: "/account",
	            className: "btn btn-outline btn-block",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "user",
	              size: 18
	            }), " Account"]
	          })
	        })]
	      })]
	    })]
	  });
	}

	function Footer() {
	  return /*#__PURE__*/jsxRuntimeExports.jsx("footer", {
	    className: "ftr",
	    children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "container",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "ftr__top",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "ftr__brand",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Logo, {
	            light: true
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            children: "Modern wellness, beauty and everyday care \u2014 cleanly formulated, honestly made, and delivered to your door."
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "ftr__social",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("a", {
	              href: "#",
	              className: "iconbtn",
	              "aria-label": "Instagram",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "instagram",
	                size: 20
	              })
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	              href: "#",
	              className: "iconbtn",
	              "aria-label": "Facebook",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "facebook",
	                size: 20
	              })
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	              href: "#",
	              className: "iconbtn",
	              "aria-label": "Twitter",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "twitter",
	                size: 20
	              })
	            })]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "ftr__col",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h4", {
	            children: "Shop"
	          }), categories.slice(0, 6).map(c => /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: `/category/${c.slug}`,
	            children: c.name
	          }, c.slug)), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/shop",
	            children: "All products"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "ftr__col",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h4", {
	            children: "Care"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/account",
	            children: "My account"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/account",
	            children: "Track my order"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/cart",
	            children: "My cart"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/wishlist",
	            children: "Wishlist"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Shipping & returns"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Contact us"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "ftr__col",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h4", {
	            children: "Our promise"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Clean ingredients"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Sustainability"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Cruelty-free"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Journal"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "About Sora Life"
	          })]
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "ftr__trust",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "leaf",
	            size: 17
	          }), " Clean, transparent formulas"]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "shield",
	            size: 17
	          }), " Dermatologist & lab tested"]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "truck",
	            size: 17
	          }), " Carbon-neutral delivery"]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "return",
	            size: 17
	          }), " Easy 15-day returns"]
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "ftr__bottom",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	          children: ["\xA9 ", new Date().getFullYear(), " Sora Life. A demo storefront \u2014 placeholder products for design preview."]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "ftr__legal",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Privacy"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Terms"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            children: "Cookies"
	          })]
	        })]
	      })]
	    })
	  });
	}

	function MobileTabBar() {
	  const {
	    cartCount,
	    wishCount
	  } = useStore();
	  const item = ({
	    isActive
	  }) => `tabbar__item ${isActive ? 'active' : ''}`;
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	    className: "tabbar only-mobile",
	    "aria-label": "Mobile navigation",
	    children: [/*#__PURE__*/jsxRuntimeExports.jsxs(NavLink, {
	      to: "/",
	      className: item,
	      end: true,
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	        name: "home",
	        size: 22
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        children: "Home"
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs(NavLink, {
	      to: "/shop",
	      className: item,
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	        name: "grid",
	        size: 22
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        children: "Shop"
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs(NavLink, {
	      to: "/wishlist",
	      className: item,
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	        className: "tabbar__ic",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "heart",
	          size: 22
	        }), wishCount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("i", {
	          className: "tabbar__dot"
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        children: "Saved"
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs(NavLink, {
	      to: "/cart",
	      className: item,
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	        className: "tabbar__ic",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "bag",
	          size: 22
	        }), cartCount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("i", {
	          className: "tabbar__badge",
	          children: cartCount
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        children: "Cart"
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs(NavLink, {
	      to: "/account",
	      className: item,
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	        name: "user",
	        size: 22
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        children: "Account"
	      })]
	    })]
	  });
	}

	function Toasts() {
	  const {
	    toasts
	  } = useStore();
	  return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	    className: "toast-wrap",
	    role: "status",
	    "aria-live": "polite",
	    children: toasts.map(t => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "toast",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "t-ic",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: t.kind === 'wish' ? 'heart' : 'checkCircle',
	          size: 18
	        })
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "t-body",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	          children: t.message
	        })
	      })]
	    }, t.id))
	  });
	}

	function ScrollToTop() {
	  const {
	    pathname
	  } = useLocation();
	  reactExports.useEffect(() => {
	    window.scrollTo({
	      top: 0,
	      behavior: 'instant' in window ? 'instant' : 'auto'
	    });
	  }, [pathname]);
	  return null;
	}
	function Layout() {
	  const {
	    pathname
	  } = useLocation();
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx(ScrollToTop, {}), /*#__PURE__*/jsxRuntimeExports.jsx(Header, {}), /*#__PURE__*/jsxRuntimeExports.jsx("main", {
	      className: "page-main",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx(Outlet, {})
	    }, pathname), /*#__PURE__*/jsxRuntimeExports.jsx(Footer, {}), /*#__PURE__*/jsxRuntimeExports.jsx(MobileTabBar, {}), /*#__PURE__*/jsxRuntimeExports.jsx(Toasts, {}), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	      className: "chatbtn",
	      "aria-label": "Chat with us",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	        name: "chat",
	        size: 20
	      }), " ", /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        children: "Chat with us"
	      })]
	    })]
	  });
	}

	function Reveal({
	  children,
	  as: Tag = 'div',
	  delay = 0,
	  className = '',
	  ...rest
	}) {
	  const ref = reactExports.useRef(null);
	  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	  const [shown, setShown] = reactExports.useState(!!reduced);
	  reactExports.useEffect(() => {
	    if (reduced || shown) return;
	    const el = ref.current;
	    if (!el) return;
	    const io = new IntersectionObserver(entries => entries.forEach(e => {
	      if (e.isIntersecting) {
	        setShown(true);
	        io.disconnect();
	      }
	    }), {
	      threshold: 0.12,
	      rootMargin: '0px 0px -40px 0px'
	    });
	    io.observe(el);
	    return () => io.disconnect();
	  }, [reduced, shown]);
	  return /*#__PURE__*/jsxRuntimeExports.jsx(Tag, {
	    ref: ref,
	    className: `reveal ${shown ? 'is-in' : ''} ${className}`,
	    style: {
	      transitionDelay: `${delay}ms`
	    },
	    ...rest,
	    children: children
	  });
	}

	const BENEFITS = [{
	  icon: 'award',
	  a: 'Himalayan',
	  b: 'Superfood'
	}, {
	  icon: 'leaf',
	  a: 'Rich in 190+',
	  b: 'Nutrients'
	}, {
	  icon: 'shield',
	  a: 'Boosts Immunity',
	  b: '& Wellness'
	}];

	// Slide 1 keeps the existing sea-buckthorn hero (video + poster).
	// Slide 2 uses the approved artwork at /media/hero-slide2.jpg.
	const SLIDES = [{
	  id: 'buckthorn',
	  kind: 'video',
	  src: '/media/hero.mp4',
	  poster: '/media/hero-poster.jpg',
	  kicker: 'The Power of',
	  title: 'Sea Buckthorn',
	  sub: 'Harvested from the Himalayas. Made for your wellness.',
	  lede: 'Pure nutrition. Natural radiance. Everyday wellness.',
	  cta: {
	    label: 'EXPLORE COLLECTION',
	    to: '/category/wellness'
	  },
	  position: 'center'
	}, {
	  id: 'harvest',
	  kind: 'image',
	  src: '/media/hero-slide2.jpg',
	  kicker: 'From the Himalayas',
	  title: "Nature's Orange Gold",
	  sub: 'Sun-ripened sea buckthorn, gently cold-pressed.',
	  lede: 'Nutrient-dense wellness, straight from the mountains.',
	  cta: {
	    label: 'SHOP JUICES & DRINKS',
	    to: '/category/juices-drinks'
	  },
	  position: 'center'
	}];
	const INTERVAL = 6000;
	function Hero() {
	  const [active, setActive] = reactExports.useState(0);
	  const [paused, setPaused] = reactExports.useState(false);
	  const timer = reactExports.useRef(null);
	  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	  const go = reactExports.useCallback(i => setActive((i + SLIDES.length) % SLIDES.length), []);
	  const next = reactExports.useCallback(() => setActive(a => (a + 1) % SLIDES.length), []);
	  reactExports.useEffect(() => {
	    if (paused || reduced || SLIDES.length < 2) return;
	    timer.current = setTimeout(next, INTERVAL);
	    return () => clearTimeout(timer.current);
	  }, [active, paused, reduced, next]);
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
	    className: "bh-hero bh-hero--carousel",
	    onMouseEnter: () => setPaused(true),
	    onMouseLeave: () => setPaused(false),
	    "aria-roledescription": "carousel",
	    "aria-label": "Sora Life featured",
	    children: [SLIDES.map((s, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: `bh-slide ${i === active ? 'is-active' : ''}`,
	      "aria-hidden": i !== active,
	      children: [s.kind === 'video' ? /*#__PURE__*/jsxRuntimeExports.jsx("video", {
	        className: "bh-hero__media",
	        autoPlay: true,
	        muted: true,
	        loop: true,
	        playsInline: true,
	        poster: s.poster,
	        style: {
	          objectPosition: s.position
	        },
	        children: /*#__PURE__*/jsxRuntimeExports.jsx("source", {
	          src: s.src,
	          type: "video/mp4"
	        })
	      }) : /*#__PURE__*/jsxRuntimeExports.jsx("img", {
	        className: "bh-hero__media",
	        src: s.src,
	        alt: s.title,
	        loading: i === 0 ? 'eager' : 'lazy',
	        style: {
	          objectPosition: s.position
	        }
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "bh-hero__scrim"
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "container bh-hero__inner",
	        children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "bh-hero__copy",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            className: "bh-hero__kicker",
	            children: s.kicker
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
	            className: "bh-hero__title",
	            children: s.title
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            className: "bh-hero__sub",
	            children: s.sub
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            className: "bh-hero__lede",
	            children: s.lede
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	            to: s.cta.to,
	            className: "btn btn-lg bh-hero__cta",
	            children: [s.cta.label, " ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "arrowRight",
	              size: 18
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "bh-hero__benefits",
	            children: BENEFITS.map((b, bi) => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "bh-hero__benefit",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: b.icon,
	                size: 22
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                children: [b.a, /*#__PURE__*/jsxRuntimeExports.jsx("br", {}), b.b]
	              }), bi < BENEFITS.length - 1 && /*#__PURE__*/jsxRuntimeExports.jsx("i", {
	                className: "bh-hero__bdiv"
	              })]
	            }, b.b))
	          })]
	        })
	      })]
	    }, s.id)), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	      className: "bh-hero__arrow bh-hero__arrow--prev",
	      onClick: () => go(active - 1),
	      "aria-label": "Previous slide",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	        name: "chevronLeft",
	        size: 22
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	      className: "bh-hero__arrow bh-hero__arrow--next",
	      onClick: () => go(active + 1),
	      "aria-label": "Next slide",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	        name: "chevronRight",
	        size: 22
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "bh-hero__dots",
	      children: SLIDES.map((s, i) => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	        className: i === active ? 'active' : '',
	        onClick: () => go(i),
	        "aria-label": `Go to slide ${i + 1}`,
	        "aria-current": i === active
	      }, s.id))
	    })]
	  });
	}

	function StarRating({
	  value = 0,
	  count,
	  size = 15,
	  showValue = false
	}) {
	  const full = Math.round(value);
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	    className: "rating-row",
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	      className: "stars",
	      "aria-label": `${value} out of 5 stars`,
	      children: [1, 2, 3, 4, 5].map(i => /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	        name: "star",
	        size: size,
	        fill: i <= full ? 'currentColor' : 'none',
	        className: i <= full ? 's-full' : 's-empty',
	        stroke: 1.4
	      }, i))
	    }), showValue && /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	      style: {
	        color: 'var(--color-text)',
	        fontWeight: 600
	      },
	      children: value.toFixed(1)
	    }), typeof count === 'number' && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	      children: ["(", count.toLocaleString('en-IN'), ")"]
	    })]
	  });
	}

	function PriceTag({
	  product,
	  showOff = true,
	  size
	}) {
	  const {
	    price,
	    mrp,
	    discountPct,
	    currency,
	    priceVerified
	  } = product;
	  if (priceVerified === false) {
	    return /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	      className: "price",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "price-tbd muted",
	        children: "Price coming soon"
	      })
	    });
	  }
	  const hasDiscount = mrp > price;
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	    className: `price ${size === 'lg' ? 'price--lg' : ''}`,
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	      className: "now",
	      children: money(price, currency)
	    }), hasDiscount && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	      className: "was",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "was-lbl",
	        children: "MRP"
	      }), " ", money(mrp, currency)]
	    }), showOff && discountPct > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	      className: "off",
	      children: [discountPct, "% off"]
	    })]
	  });
	}

	function QuickView({
	  product,
	  onClose
	}) {
	  const {
	    addToCart,
	    toggleWish,
	    isWished
	  } = useStore();
	  const [qty, setQty] = reactExports.useState(1);
	  const [variant, setVariant] = reactExports.useState(product.variants?.[0]?.label || null);
	  const cat = categoryBySlug[product.category];
	  reactExports.useEffect(() => {
	    const onKey = e => e.key === 'Escape' && onClose();
	    document.addEventListener('keydown', onKey);
	    document.body.style.overflow = 'hidden';
	    return () => {
	      document.removeEventListener('keydown', onKey);
	      document.body.style.overflow = '';
	    };
	  }, [onClose]);
	  return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	    className: "modal-scrim",
	    onClick: onClose,
	    role: "dialog",
	    "aria-modal": "true",
	    "aria-label": `Quick view: ${product.name}`,
	    children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "modal qv",
	      onClick: e => e.stopPropagation(),
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	        className: "iconbtn modal__close",
	        onClick: onClose,
	        "aria-label": "Close",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "x"
	        })
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "qv__grid",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "qv__media",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	            product: product
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "qv__info",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "pcard__cat",
	            children: cat?.name
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	            style: {
	              fontSize: 'var(--text-2xl)',
	              margin: '4px 0 8px'
	            },
	            children: product.name
	          }), product.reviewCount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx(StarRating, {
	            value: product.rating,
	            count: product.reviewCount
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            className: "muted",
	            style: {
	              margin: '14px 0'
	            },
	            children: product.shortDescription
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(PriceTag, {
	            product: product,
	            size: "lg"
	          }), product.variants && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            style: {
	              marginTop: 18
	            },
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	              className: "label",
	              style: {
	                marginBottom: 8
	              },
	              children: "Variant"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	              className: "taglist",
	              children: product.variants.map(v => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	                className: `chip ${variant === v.label ? 'active' : ''}`,
	                onClick: () => setVariant(v.label),
	                children: v.label
	              }, v.id))
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "qv__actions",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "qty",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	                onClick: () => setQty(q => Math.max(1, q - 1)),
	                "aria-label": "Decrease",
	                children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "minus",
	                  size: 16
	                })
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                children: qty
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	                onClick: () => setQty(q => q + 1),
	                "aria-label": "Increase",
	                children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "plus",
	                  size: 16
	                })
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	              className: "btn btn-block",
	              onClick: () => {
	                addToCart(product, qty, variant);
	                onClose();
	              },
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "bag",
	                size: 18
	              }), " Add to cart"]
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "iconbtn",
	              style: {
	                border: '1px solid var(--line)'
	              },
	              onClick: () => toggleWish(product),
	              "aria-label": "Wishlist",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "heart",
	                size: 20,
	                fill: isWished(product.id) ? 'currentColor' : 'none',
	                style: isWished(product.id) ? {
	                  color: 'var(--color-sale)'
	                } : undefined
	              })
	            })]
	          }), product.benefits?.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
	            className: "qv__benefits",
	            children: product.benefits.slice(0, 3).map(b => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "check",
	                size: 16
	              }), " ", b]
	            }, b))
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	            to: `/product/${product.slug}`,
	            className: "sec-link",
	            onClick: onClose,
	            style: {
	              marginTop: 4
	            },
	            children: ["View full details ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "arrowRight",
	              size: 16
	            })]
	          })]
	        })]
	      })]
	    })
	  });
	}

	const badgeClass = {
	  new: 'badge-new',
	  best: 'badge-best',
	  sale: 'badge-sale'
	};
	function ProductCard({
	  product
	}) {
	  const {
	    addToCart,
	    toggleWish,
	    isWished
	  } = useStore();
	  const [qv, setQv] = reactExports.useState(false);
	  const wished = isWished(product.id);
	  const out = product.stock === 0;
	  const cat = categoryBySlug[product.category];
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("article", {
	    className: "pcard",
	    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "pcard__media",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	        to: `/product/${product.slug}`,
	        "aria-label": product.name,
	        children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	          product: product
	        })
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "pcard__badges",
	        children: out ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "badge badge-out",
	          children: "Sold out"
	        }) : product.badges.slice(0, 2).map(b => /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: `badge ${badgeClass[b.type] || ''}`,
	          children: b.label
	        }, b.type))
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	        className: `pcard__wish ${wished ? 'active' : ''}`,
	        onClick: () => toggleWish(product),
	        "aria-pressed": wished,
	        "aria-label": wished ? 'Remove from wishlist' : 'Add to wishlist',
	        children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "heart",
	          size: 20,
	          fill: wished ? 'currentColor' : 'none'
	        })
	      }), !out && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "pcard__quick",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	          className: "btn btn-sm btn-block",
	          onClick: () => addToCart(product),
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "bag",
	            size: 16
	          }), " Quick add"]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	          className: "btn btn-sm btn-light",
	          onClick: () => setQv(true),
	          "aria-label": "Quick view",
	          title: "Quick view",
	          style: {
	            paddingInline: 12
	          },
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "eye",
	            size: 16
	          })
	        })]
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "pcard__body",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	        className: "pcard__cat",
	        children: [cat?.name, product.form ? ` · ${product.form}` : '']
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	        className: "pcard__name",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	          to: `/product/${product.slug}`,
	          children: product.name
	        })
	      }), product.reviewCount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx(StarRating, {
	        value: product.rating,
	        count: product.reviewCount,
	        size: 14
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "pcard__foot",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(PriceTag, {
	          product: product,
	          showOff: false
	        }), out ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "hint",
	          children: "Notify me"
	        }) : /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	          className: "iconbtn",
	          style: {
	            width: 40,
	            height: 40,
	            background: 'var(--forest-50)'
	          },
	          onClick: () => addToCart(product),
	          "aria-label": "Add to cart",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "plus",
	            size: 18
	          })
	        })]
	      })]
	    }), qv && /*#__PURE__*/jsxRuntimeExports.jsx(QuickView, {
	      product: product,
	      onClose: () => setQv(false)
	    })]
	  });
	}

	function Newsletter() {
	  const [email, setEmail] = reactExports.useState('');
	  const [done, setDone] = reactExports.useState(false);
	  const [err, setErr] = reactExports.useState('');
	  const submit = e => {
	    e.preventDefault();
	    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
	      setErr('Please enter a valid email address.');
	      return;
	    }
	    setErr('');
	    setDone(true);
	  };
	  return /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	    className: "section nl",
	    children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "container",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "nl__card",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "nl__deco",
	          "aria-hidden": "true",
	          children: /*#__PURE__*/jsxRuntimeExports.jsxs("svg", {
	            viewBox: "0 0 200 200",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("path", {
	              d: "M100 20c40 34 40 96 0 160-40-64-40-126 0-160Z",
	              fill: "var(--honey-500)",
	              opacity: "0.16"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("path", {
	              d: "M100 40c26 24 26 72 0 120-26-48-26-96 0-120Z",
	              fill: "var(--forest-300)",
	              opacity: "0.22"
	            })]
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "nl__body",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "eyebrow",
	            style: {
	              color: 'var(--honey-300)'
	            },
	            children: "The Sora Letter"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	            className: "serif",
	            style: {
	              color: '#FBF8F1',
	              fontSize: 'var(--text-3xl)',
	              margin: '10px 0 8px'
	            },
	            children: "Wellness notes, quietly good offers."
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            style: {
	              color: 'rgba(251,248,241,0.8)',
	              maxWidth: '46ch'
	            },
	            children: "Join for early access to new drops, seasonal rituals and 10% off your first order. No noise \u2014 we promise."
	          }), done ? /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "nl__done",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "t-ic",
	              style: {
	                background: 'rgba(232,176,75,0.2)'
	              },
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "check",
	                size: 18
	              })
	            }), " You're in. Check your inbox for your welcome code."]
	          }) : /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
	            className: "nl__form",
	            onSubmit: submit,
	            noValidate: true,
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "searchbox nl__input",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "mail"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                type: "email",
	                placeholder: "you@email.com",
	                value: email,
	                onChange: e => setEmail(e.target.value),
	                "aria-label": "Email address"
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "btn btn-accent btn-lg",
	              type: "submit",
	              children: "Subscribe"
	            })]
	          }), err && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            className: "error-text",
	            style: {
	              marginTop: 8
	            },
	            children: err
	          })]
	        })]
	      })
	    })
	  });
	}

	const EDITORIALS = [{
	  title: 'Pure Himalayan Wellness',
	  copy: 'Nourish your body with the purity of nature.',
	  cta: 'SHOP WELLNESS',
	  to: '/category/wellness',
	  tone: 'forest'
	}, {
	  title: 'For Healthy Hair, Naturally',
	  copy: 'Strength from root to tip with nature’s best.',
	  cta: 'SHOP HAIR CARE',
	  to: '/category/hair-care',
	  tone: 'plum'
	}, {
	  title: 'Nourish Your Skin',
	  copy: 'The natural way.',
	  cta: 'SHOP SKIN CARE',
	  to: '/category/skin-care',
	  tone: 'rose'
	}];
	function Home() {
	  const railRef = reactExports.useRef(null);
	  const bestsellers = getBestsellers(12);
	  const newArrivals = getNewArrivals(6);
	  const scrollRail = dir => {
	    const el = railRef.current;
	    if (el) el.scrollBy({
	      left: dir * (el.clientWidth * 0.8),
	      behavior: 'smooth'
	    });
	  };
	  const editorialProduct = slug => getByCategory(slug).find(p => p.stock > 0) || getByCategory(slug)[0];
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx(Hero, {}), /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	      className: "bh-cats",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "container",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "bh-cats__row",
	          children: categories.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	            to: `/category/${c.slug}`,
	            className: "bh-cat",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: `bh-cat__circle tone-${c.tone}`,
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	                product: getByCategory(c.slug)[0]
	              })
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "bh-cat__name",
	              children: c.name
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "bh-cat__view",
	              children: "View all"
	            })]
	          }, c.slug))
	        })
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	      className: "bh-best",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "bh-best__head",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	              className: "serif bh-best__title",
	              children: "Bestsellers"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	              className: "muted",
	              children: "Our most loved products by our customers"
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	            to: "/shop?sort=bestselling",
	            className: "bh-best__all",
	            children: ["VIEW ALL BESTSELLERS ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "arrowRight",
	              size: 16
	            })]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "bh-best__wrap",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "bh-grid",
	            ref: railRef,
	            children: bestsellers.map(p => /*#__PURE__*/jsxRuntimeExports.jsx(ProductCard, {
	              product: p
	            }, p.id))
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "bh-best__arrow",
	            onClick: () => scrollRail(1),
	            "aria-label": "Scroll products",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "chevronRight",
	              size: 20
	            })
	          })]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	      className: "bh-edit-wrap",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "container",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "bh-edit",
	          children: EDITORIALS.map(e => {
	            const p = editorialProduct(e.to.split('/').pop());
	            return /*#__PURE__*/jsxRuntimeExports.jsx(Reveal, {
	              children: /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	                to: e.to,
	                className: `bh-editcard tone-${e.tone}`,
	                children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                  className: "bh-editcard__body",
	                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	                    className: "serif",
	                    children: e.title
	                  }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	                    children: e.copy
	                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                    className: "bh-editcard__cta",
	                    children: [e.cta, " ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                      name: "arrowRight",
	                      size: 15
	                    })]
	                  })]
	                }), p && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	                  className: "bh-editcard__img",
	                  children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	                    product: p
	                  })
	                })]
	              })
	            }, e.title);
	          })
	        })
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	      className: "section-sm",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "sec-head",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "eyebrow",
	              children: "Just added"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	              className: "sec-title serif",
	              style: {
	                marginTop: 8
	              },
	              children: "New in at Sora Life"
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	            to: "/shop?filter=new",
	            className: "sec-link",
	            children: ["View all ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "arrowRight",
	              size: 17
	            })]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "rail",
	          children: newArrivals.slice(0, 4).map(p => /*#__PURE__*/jsxRuntimeExports.jsx(ProductCard, {
	            product: p
	          }, p.id))
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	      className: "bh-promise",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "container bh-promise__in",
	        children: [['leaf', '100% Natural', 'Sea-buckthorn sourced from the Himalayas'], ['award', 'Made in India', 'Ethically produced, lab verified'], ['shield', 'Authentic Biosash', 'Genuine products, authorised store'], ['truck', 'Fast Delivery', 'Free shipping over ₹699 · COD available']].map(([ic, t, s]) => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "bh-promise__item",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "bh-promise__ic",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: ic,
	              size: 22
	            })
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: t
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("em", {
	              children: s
	            })]
	          })]
	        }, t))
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx(Newsletter, {})]
	  });
	}

	const SORTS = [{
	  id: 'featured',
	  label: 'Featured'
	}, {
	  id: 'bestselling',
	  label: 'Best selling'
	}, {
	  id: 'price-asc',
	  label: 'Price: low to high'
	}, {
	  id: 'price-desc',
	  label: 'Price: high to low'
	}, {
	  id: 'rating',
	  label: 'Top rated'
	}, {
	  id: 'new',
	  label: 'Newest'
	}];
	function ProductBrowser({
	  baseProducts,
	  lockCategory = false,
	  showCategoryFilter = true
	}) {
	  const [params, setParams] = useSearchParams();
	  const q = params.get('q') || '';
	  const initialSort = params.get('sort') || 'featured';
	  const initialFlag = params.get('filter') || '';
	  const [sort, setSort] = reactExports.useState(initialSort);
	  const [selCats, setSelCats] = reactExports.useState(new Set());
	  const [priceMax, setPriceMax] = reactExports.useState(priceRange.max);
	  const [minRating, setMinRating] = reactExports.useState(0);
	  const [flags, setFlags] = reactExports.useState(new Set(initialFlag ? [initialFlag] : []));
	  const [inStock, setInStock] = reactExports.useState(false);
	  const [drawer, setDrawer] = reactExports.useState(false);
	  reactExports.useEffect(() => {
	    setSort(params.get('sort') || 'featured');
	  }, [params]);
	  const toggleSet = (setter, set, val) => {
	    const next = new Set(set);
	    next.has(val) ? next.delete(val) : next.add(val);
	    setter(next);
	  };
	  const searched = reactExports.useMemo(() => {
	    if (!q) return baseProducts;
	    const ids = new Set(searchProducts(q).map(p => p.id));
	    return baseProducts.filter(p => ids.has(p.id));
	  }, [q, baseProducts]);
	  const filtered = reactExports.useMemo(() => {
	    let list = searched.filter(p => p.price <= priceMax && p.rating >= minRating);
	    if (selCats.size) list = list.filter(p => [...selCats].some(c => (p.categories || [p.category]).includes(c)));
	    if (inStock) list = list.filter(p => p.stock > 0);
	    if (flags.size) list = list.filter(p => [...flags].every(f => f === 'sale' ? p.discountPct > 0 : p.flags.includes(f)));
	    const s = [...list];
	    switch (sort) {
	      case 'price-asc':
	        s.sort((a, b) => a.price - b.price);
	        break;
	      case 'price-desc':
	        s.sort((a, b) => b.price - a.price);
	        break;
	      case 'rating':
	        s.sort((a, b) => b.rating - a.rating);
	        break;
	      case 'bestselling':
	        s.sort((a, b) => b.reviewCount - a.reviewCount);
	        break;
	      case 'new':
	        s.sort((a, b) => Number(b.isNew) - Number(a.isNew));
	        break;
	      default:
	        s.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
	    }
	    return s;
	  }, [searched, priceMax, minRating, selCats, inStock, flags, sort]);
	  const activeCount = selCats.size + flags.size + (minRating ? 1 : 0) + (inStock ? 1 : 0) + (priceMax < priceRange.max ? 1 : 0);
	  const clearAll = () => {
	    setSelCats(new Set());
	    setFlags(new Set());
	    setMinRating(0);
	    setInStock(false);
	    setPriceMax(priceRange.max);
	  };
	  const onSort = id => {
	    setSort(id);
	    const p = new URLSearchParams(params);
	    p.set('sort', id);
	    setParams(p, {
	      replace: true
	    });
	  };
	  const FilterPanel = /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    className: "filters",
	    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "filters__head",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	        style: {
	          fontSize: 'var(--text-lg)'
	        },
	        children: "Filters"
	      }), activeCount > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	        className: "filters__clear",
	        onClick: clearAll,
	        children: ["Clear all (", activeCount, ")"]
	      })]
	    }), showCategoryFilter && !lockCategory && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "filters__group",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "filters__title",
	        children: "Category"
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "filters__opts",
	        children: categories.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
	          className: "check",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
	            type: "checkbox",
	            checked: selCats.has(c.slug),
	            onChange: () => toggleSet(setSelCats, selCats, c.slug)
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "check__box",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "check",
	              size: 13
	            })
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            children: c.name
	          })]
	        }, c.slug))
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "filters__group",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "filters__title",
	        children: "Highlights"
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "filters__opts",
	        children: [[['bestseller', 'Bestsellers'], ['new', 'New arrivals'], ['sale', 'On sale']].map(([id, label]) => /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
	          className: "check",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
	            type: "checkbox",
	            checked: flags.has(id),
	            onChange: () => toggleSet(setFlags, flags, id)
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "check__box",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "check",
	              size: 13
	            })
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            children: label
	          })]
	        }, id)), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
	          className: "check",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
	            type: "checkbox",
	            checked: inStock,
	            onChange: e => setInStock(e.target.checked)
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "check__box",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "check",
	              size: 13
	            })
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            children: "In stock only"
	          })]
	        })]
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "filters__group",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "filters__title",
	        children: "Max price"
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	        type: "range",
	        className: "range",
	        min: priceRange.min,
	        max: priceRange.max,
	        step: 50,
	        value: priceMax,
	        onChange: e => setPriceMax(Number(e.target.value))
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "filters__range-lbl",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          children: money(priceRange.min)
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
	          children: ["Up to ", money(priceMax)]
	        })]
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "filters__group",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "filters__title",
	        children: "Rating"
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "taglist",
	        children: [0, 4, 4.5].map(r => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	          className: `chip ${minRating === r ? 'active' : ''}`,
	          onClick: () => setMinRating(r),
	          children: r === 0 ? 'Any' : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "star",
	              size: 13,
	              fill: "currentColor"
	            }), " ", r, "+"]
	          })
	        }, r))
	      })]
	    })]
	  });
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    className: "browser container",
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("aside", {
	      className: "browser__aside hide-mobile",
	      children: FilterPanel
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "browser__main",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "browser__bar",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	          className: "browser__count",
	          children: [q && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	            children: ["Results for \u201C", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: q
	            }), "\u201D \xB7 "]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	            children: filtered.length
	          }), " ", filtered.length === 1 ? 'product' : 'products']
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "browser__tools",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	            className: "chip only-mobile",
	            onClick: () => setDrawer(true),
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "sliders",
	              size: 16
	            }), " Filters", activeCount ? ` · ${activeCount}` : '']
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
	            className: "sortsel",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "hide-mobile",
	              children: "Sort"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
	              className: "select",
	              value: sort,
	              onChange: e => onSort(e.target.value),
	              children: SORTS.map(s => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
	                value: s.id,
	                children: s.label
	              }, s.id))
	            }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "chevronDown",
	              size: 16
	            })]
	          })]
	        })]
	      }), filtered.length ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "pgrid",
	        children: filtered.map(p => /*#__PURE__*/jsxRuntimeExports.jsx(ProductCard, {
	          product: p
	        }, p.id))
	      }) : /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "state",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "state-ic",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "search",
	            size: 32
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	          children: "Nothing matched"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          children: "Try clearing a filter or searching a different term."
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	          className: "btn btn-outline",
	          onClick: clearAll,
	          children: "Clear filters"
	        })]
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: `fdrawer ${drawer ? 'open' : ''}`,
	      "aria-hidden": !drawer,
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "drawer__scrim",
	        onClick: () => setDrawer(false)
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "fdrawer__panel",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "drawer__top",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	            style: {
	              fontSize: 'var(--text-lg)'
	            },
	            children: "Filters"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "iconbtn",
	            onClick: () => setDrawer(false),
	            "aria-label": "Close",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "x"
	            })
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "fdrawer__scroll",
	          children: FilterPanel
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "fdrawer__foot",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "btn btn-ghost",
	            onClick: clearAll,
	            children: "Clear"
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	            className: "btn btn-block",
	            onClick: () => setDrawer(false),
	            children: ["Show ", filtered.length, " results"]
	          })]
	        })]
	      })]
	    })]
	  });
	}

	function Shop() {
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "pagehead",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	          className: "crumbs",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/",
	            children: "Home"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "chevronRight",
	            size: 14
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            children: "Shop"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
	          className: "serif",
	          children: "All products"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          className: "muted",
	          children: "Everything Sora Life makes \u2014 wellness, nutrition, hair, skin, beauty and everyday care in one place."
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "section-sm",
	      style: {
	        paddingTop: 'var(--sp-8)'
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductBrowser, {
	        baseProducts: products
	      })
	    })]
	  });
	}

	function NotFound() {
	  return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	    className: "container section",
	    children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "state",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	        className: "state-ic",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "leaf",
	          size: 32
	        })
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	        style: {
	          fontSize: 'var(--text-4xl)'
	        },
	        children: "404"
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	        children: "We couldn't find that page. It may have moved, or the link is out of date."
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        style: {
	          display: 'flex',
	          gap: 12,
	          justifyContent: 'center',
	          flexWrap: 'wrap'
	        },
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	          to: "/",
	          className: "btn",
	          children: "Back home"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	          to: "/shop",
	          className: "btn btn-outline",
	          children: "Browse the shop"
	        })]
	      })]
	    })
	  });
	}

	function Category() {
	  const {
	    slug
	  } = useParams();
	  const cat = categoryBySlug[slug];
	  if (!cat) return /*#__PURE__*/jsxRuntimeExports.jsx(NotFound, {});
	  const items = getByCategory(slug);
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("section", {
	      className: `cathero tone-${cat.tone}`,
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container cathero__in",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	            className: "crumbs",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	              to: "/",
	              children: "Home"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "chevronRight",
	              size: 14
	            }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	              to: "/shop",
	              children: "Shop"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "chevronRight",
	              size: 14
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              children: cat.name
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "eyebrow",
	            children: cat.tagline
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
	            className: "serif cathero__title",
	            children: cat.name
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            className: "cathero__blurb",
	            children: cat.blurb
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	            className: "cathero__count",
	            children: [items.length, " products"]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "cathero__chips",
	          children: categories.filter(c => c.slug !== slug).slice(0, 6).map(c => /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: `/category/${c.slug}`,
	            className: "chip",
	            children: c.name
	          }, c.slug))
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "section-sm",
	      style: {
	        paddingTop: 'var(--sp-8)'
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductBrowser, {
	        baseProducts: items,
	        lockCategory: true,
	        showCategoryFilter: false
	      })
	    })]
	  });
	}

	function ProductRail({
	  eyebrow,
	  title,
	  description,
	  products,
	  link,
	  linkLabel = 'View all',
	  limit = 4
	}) {
	  const items = products.slice(0, limit);
	  if (!items.length) return null;
	  return /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	    className: "section",
	    children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "container",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "sec-head",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          children: [eyebrow && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "eyebrow",
	            children: eyebrow
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	            className: "sec-title serif",
	            style: {
	              marginTop: 8
	            },
	            children: title
	          }), description && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	            children: description
	          })]
	        }), link && /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	          to: link,
	          className: "sec-link",
	          children: [linkLabel, " ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "arrowRight",
	            size: 17
	          })]
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "rail",
	        children: items.map((p, i) => /*#__PURE__*/jsxRuntimeExports.jsx(Reveal, {
	          delay: i * 60,
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductCard, {
	            product: p
	          })
	        }, p.id))
	      })]
	    })
	  });
	}

	function GalleryFrame({
	  product,
	  index
	}) {
	  if (index === 0) return /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	    product: product
	  });
	  const t = tones[categoryBySlug[product.category]?.tone] || tones.forest;
	  const labels = ['Texture', 'Ingredients', 'In use'];
	  const icons = ['droplet', 'leaf', 'sparkle'];
	  return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	    className: "pimg",
	    style: {
	      background: `linear-gradient(150deg, ${t.tint}, #fff)`
	    },
	    children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      style: {
	        position: 'absolute',
	        inset: 0,
	        display: 'grid',
	        placeItems: 'center',
	        color: t.b
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        style: {
	          textAlign: 'center'
	        },
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: icons[index - 1],
	          size: 40
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          style: {
	            marginTop: 10,
	            fontFamily: 'var(--font-display)',
	            fontWeight: 600
	          },
	          children: labels[index - 1]
	        })]
	      })
	    })
	  });
	}
	function Accordion({
	  items
	}) {
	  const [open, setOpen] = reactExports.useState(0);
	  return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	    className: "accordion",
	    children: items.map((it, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: `accordion__item ${open === i ? 'open' : ''}`,
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	        className: "accordion__head",
	        onClick: () => setOpen(open === i ? -1 : i),
	        "aria-expanded": open === i,
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          children: it.title
	        }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: open === i ? 'chevronUp' : 'chevronDown',
	          size: 18
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "accordion__body",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "accordion__inner",
	          children: it.content
	        })
	      })]
	    }, it.title))
	  });
	}
	function Product() {
	  const {
	    slug
	  } = useParams();
	  const navigate = useNavigate();
	  const {
	    addToCart,
	    toggleWish,
	    isWished
	  } = useStore();
	  const product = productBySlug[slug];
	  const [frame, setFrame] = reactExports.useState(0);
	  const [qty, setQty] = reactExports.useState(1);
	  const [variant, setVariant] = reactExports.useState(product?.variants?.[0]?.label || null);
	  if (!product) return /*#__PURE__*/jsxRuntimeExports.jsx(NotFound, {});
	  const cat = categoryBySlug[product.category];
	  const related = getRelated(product);
	  const wished = isWished(product.id);
	  const out = product.stock === 0;
	  const lowStock = product.stock > 0 && product.stock <= 5;
	  const fbt = [product, ...related.slice(0, 2)];
	  const fbtTotal = fbt.reduce((s, p) => s + p.price, 0);
	  const buyNow = () => {
	    addToCart(product, qty, variant);
	    navigate('/checkout');
	  };
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "container",
	      style: {
	        paddingTop: 'var(--sp-6)'
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	        className: "crumbs",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	          to: "/",
	          children: "Home"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "chevronRight",
	          size: 14
	        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	          to: `/category/${cat.slug}`,
	          children: cat.name
	        }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "chevronRight",
	          size: 14
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          children: product.name
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
	      className: "pdp container",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "pdp__gallery",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "pdp__main",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(GalleryFrame, {
	            product: product,
	            index: frame
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: `pcard__wish pdp__wish ${wished ? 'active' : ''}`,
	            onClick: () => toggleWish(product),
	            "aria-label": "Wishlist",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "heart",
	              size: 22,
	              fill: wished ? 'currentColor' : 'none'
	            })
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "pdp__thumbs",
	          children: [0, 1, 2, 3].map(i => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: `pdp__thumb ${frame === i ? 'active' : ''}`,
	            onClick: () => setFrame(i),
	            "aria-label": `View ${i + 1}`,
	            children: /*#__PURE__*/jsxRuntimeExports.jsx(GalleryFrame, {
	              product: product,
	              index: i
	            })
	          }, i))
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "pdp__info",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "pcard__cat",
	          children: cat.name
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
	          className: "pdp__title serif",
	          children: product.name
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "pdp__rate",
	          children: [product.reviewCount > 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(StarRating, {
	              value: product.rating,
	              showValue: true
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("a", {
	              href: "#reviews",
	              className: "pdp__reviewlink",
	              children: [product.reviewCount, " reviews"]
	            })]
	          }) : /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	            className: "badge badge-soft",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "leaf",
	              size: 13
	            }), " Sea buckthorn"]
	          }), product.form && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	            className: "pdp__sku muted",
	            children: ["\xB7 ", product.form]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          className: "pdp__lead",
	          children: product.shortDescription
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "pdp__price",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(PriceTag, {
	            product: product,
	            size: "lg"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "muted",
	            style: {
	              fontSize: 'var(--text-sm)'
	            },
	            children: "Inclusive of all taxes"
	          })]
	        }), product.variants && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "pdp__block",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "label",
	            children: "Choose variant"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "taglist",
	            style: {
	              marginTop: 8
	            },
	            children: product.variants.map(v => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: `chip ${variant === v.label ? 'active' : ''}`,
	              onClick: () => setVariant(v.label),
	              children: v.label
	            }, v.id))
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "pdp__stock",
	          children: out ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "badge badge-out",
	            children: "Out of stock"
	          }) : lowStock ? /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	            className: "badge badge-sale",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "clock",
	              size: 13
	            }), " Only ", product.stock, " left"]
	          }) : /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	            className: "badge",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "check",
	              size: 13
	            }), " In stock"]
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "pdp__buy",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "qty",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              onClick: () => setQty(q => Math.max(1, q - 1)),
	              "aria-label": "Decrease",
	              disabled: out,
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "minus",
	                size: 16
	              })
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              children: qty
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              onClick: () => setQty(q => q + 1),
	              "aria-label": "Increase",
	              disabled: out,
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "plus",
	                size: 16
	              })
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	            className: "btn btn-block",
	            disabled: out,
	            onClick: () => addToCart(product, qty, variant),
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "bag",
	              size: 18
	            }), " Add to cart"]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	          className: "btn btn-accent btn-lg btn-block pdp__buynow",
	          disabled: out,
	          onClick: buyNow,
	          children: "Buy it now"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "pdp__assure",
	          children: [['truck', 'Free delivery', 'On orders over ₹699'], ['return', '15-day returns', 'Easy & free'], ['lock', 'Secure checkout', '100% protected']].map(([ic, t, s]) => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "pdp__assure-item",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: ic,
	              size: 20
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	                children: t
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("em", {
	                children: s
	              })]
	            })]
	          }, t))
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "pdp__deliver",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "mapPin",
	            size: 18
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	            children: ["Deliver to ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: "India"
	            }), " \u2014 estimated ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: "2\u20134 business days"
	            }), ". Enter your PIN at checkout for exact dates."]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx(Accordion, {
	          items: [{
	            title: 'Product details',
	            content: /*#__PURE__*/jsxRuntimeExports.jsxs("ul", {
	              className: "ticklist",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "check",
	                  size: 16
	                }), " Category: ", cat.name]
	              }), product.form && /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "check",
	                  size: 16
	                }), " Size: ", product.form]
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "check",
	                  size: 16
	                }), " Authentic Biosash product, sourced from the Himalayas"]
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "check",
	                  size: 16
	                }), " Fulfilled by Sora Life \xB7 genuine, sealed packaging"]
	              })]
	            })
	          }, ...(product.description ? [{
	            title: 'Description',
	            content: /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	              className: "muted",
	              children: product.description
	            })
	          }] : []), ...(product.benefits?.length ? [{
	            title: 'Key benefits',
	            content: /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
	              className: "ticklist",
	              children: product.benefits.map(b => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "check",
	                  size: 16
	                }), " ", b]
	              }, b))
	            })
	          }] : []), ...(product.ingredients?.length ? [{
	            title: 'Ingredients',
	            content: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	              className: "taglist",
	              children: product.ingredients.map(ig => /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "badge badge-soft",
	                children: ig
	              }, ig))
	            })
	          }] : []), ...(product.usage ? [{
	            title: 'How to use',
	            content: /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	              className: "muted",
	              children: product.usage
	            })
	          }] : [])]
	        })]
	      })]
	    }), related.length >= 2 && /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	      className: "section-sm",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	          className: "serif",
	          style: {
	            fontSize: 'var(--text-2xl)',
	            marginBottom: 'var(--sp-6)'
	          },
	          children: "Frequently bought together"
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "fbt",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "fbt__items",
	            children: fbt.map((p, i) => /*#__PURE__*/jsxRuntimeExports.jsxs(reactExports.Fragment, {
	              children: [/*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	                to: `/product/${p.slug}`,
	                className: "fbt__item",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	                  product: p
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                  className: "fbt__name",
	                  children: p.name
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                  className: "fbt__price",
	                  children: money(p.price)
	                })]
	              }), i < fbt.length - 1 && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "fbt__plus",
	                children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "plus",
	                  size: 18
	                })
	              })]
	            }, p.id))
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "fbt__buy",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	              className: "muted",
	              children: ["Total for ", fbt.length, " items"]
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "fbt__total serif",
	              children: money(fbtTotal)
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "btn btn-block",
	              onClick: () => {
	                fbt.forEach(p => addToCart(p, 1));
	              },
	              children: "Add all to cart"
	            })]
	          })]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("section", {
	      className: "section",
	      id: "reviews",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	          className: "serif",
	          style: {
	            fontSize: 'var(--text-2xl)',
	            marginBottom: 'var(--sp-5)'
	          },
	          children: "Reviews"
	        }), product.reviewCount > 0 && product.reviews.length ? /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "reviews-block",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "reviews-block__summary",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	              className: "reviews-block__score serif",
	              children: product.rating.toFixed(1)
	            }), /*#__PURE__*/jsxRuntimeExports.jsx(StarRating, {
	              value: product.rating,
	              size: 18
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	              className: "muted",
	              children: [product.reviewCount, " verified reviews"]
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "btn btn-outline btn-block",
	              style: {
	                marginTop: 16
	              },
	              children: "Write a review"
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "reviews-block__list",
	            children: product.reviews.map((r, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("figure", {
	              className: "rev",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                className: "rev__top",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                  className: "review__avatar",
	                  children: r.name.charAt(0)
	                }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	                    children: r.name
	                  }), r.verified && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                    className: "rev__verified",
	                    children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                      name: "checkCircle",
	                      size: 13
	                    }), " Verified buyer"]
	                  })]
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                  className: "muted rev__date",
	                  children: r.date
	                })]
	              }), /*#__PURE__*/jsxRuntimeExports.jsx(StarRating, {
	                value: r.rating,
	                size: 14
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("h4", {
	                className: "rev__title",
	                children: r.title
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	                className: "muted",
	                children: r.body
	              })]
	            }, i))
	          })]
	        }) : /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "surface pad-lg",
	          style: {
	            display: 'flex',
	            alignItems: 'center',
	            justifyContent: 'space-between',
	            gap: 'var(--sp-5)',
	            flexWrap: 'wrap'
	          },
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	              style: {
	                fontSize: 'var(--text-lg)'
	              },
	              children: "No reviews yet"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	              className: "muted",
	              children: "Be the first to share your experience with this product."
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "btn btn-outline",
	            children: "Write a review"
	          })]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx(ProductRail, {
	      eyebrow: "Complete the ritual",
	      title: "You may also like",
	      products: related
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "buybar only-mobile",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "buybar__price",
	        children: /*#__PURE__*/jsxRuntimeExports.jsx(PriceTag, {
	          product: product,
	          showOff: false
	        })
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	        className: "btn",
	        disabled: out,
	        onClick: () => addToCart(product, qty, variant),
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "bag",
	          size: 18
	        }), " Add"]
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	        className: "btn btn-accent",
	        disabled: out,
	        onClick: buyNow,
	        children: "Buy now"
	      })]
	    })]
	  });
	}

	const COUPONS = {
	  SORA10: 0.1,
	  WELCOME: 0.15
	};
	function Cart() {
	  const {
	    cartDetailed,
	    savedDetailed,
	    dispatch,
	    subtotal,
	    savings,
	    toast
	  } = useStore();
	  const [coupon, setCoupon] = reactExports.useState('');
	  const [applied, setApplied] = reactExports.useState(null);
	  const [couponErr, setCouponErr] = reactExports.useState('');
	  const applyCoupon = e => {
	    e.preventDefault();
	    const code = coupon.trim().toUpperCase();
	    if (COUPONS[code]) {
	      setApplied({
	        code,
	        rate: COUPONS[code]
	      });
	      setCouponErr('');
	      toast(`Coupon ${code} applied`);
	    } else {
	      setApplied(null);
	      setCouponErr('That code is not valid.');
	    }
	  };
	  const discount = applied ? Math.round(subtotal * applied.rate) : 0;
	  const shipping = subtotal === 0 ? 0 : subtotal - discount >= 699 ? 0 : 49;
	  const total = Math.max(0, subtotal - discount + shipping);
	  if (!cartDetailed.length) {
	    return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "container section",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "state",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "state-ic",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "bag",
	            size: 32
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	          children: "Your cart is empty"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          children: "Looks like you haven't added anything yet. Let's fix that."
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	          to: "/shop",
	          className: "btn",
	          children: ["Start shopping ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "arrowRight",
	            size: 18
	          })]
	        })]
	      }), savedDetailed.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx(SavedList, {
	        saved: savedDetailed,
	        dispatch: dispatch
	      })]
	    });
	  }
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "pagehead",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	          className: "crumbs",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/",
	            children: "Home"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "chevronRight",
	            size: 14
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            children: "Cart"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
	          className: "serif",
	          children: "Your cart"
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	          className: "muted",
	          children: [cartDetailed.length, " ", cartDetailed.length === 1 ? 'item' : 'items', " ready for a healthier routine."]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "container section-sm",
	      style: {
	        paddingTop: 'var(--sp-8)'
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "cartlayout",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "cartlayout__main",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "cartlist",
	            children: cartDetailed.map(l => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "cartrow",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	                to: `/product/${l.product.slug}`,
	                className: "cartrow__media",
	                children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	                  product: l.product
	                })
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                className: "cartrow__info",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                  className: "cartrow__top",
	                  children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                    children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	                      to: `/product/${l.product.slug}`,
	                      className: "cartrow__name serif",
	                      children: l.product.name
	                    }), l.variant && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                      className: "cartrow__variant",
	                      children: l.variant
	                    }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                      className: "cartrow__form muted",
	                      children: l.product.form
	                    })]
	                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                    className: "cartrow__price",
	                    children: [money(l.product.price * l.qty), l.product.mrp > l.product.price && /*#__PURE__*/jsxRuntimeExports.jsx("s", {
	                      children: money(l.product.mrp * l.qty)
	                    })]
	                  })]
	                }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                  className: "cartrow__actions",
	                  children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                    className: "qty qty--sm",
	                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	                      onClick: () => dispatch({
	                        type: 'SET_QTY',
	                        key: l.key,
	                        qty: l.qty - 1
	                      }),
	                      "aria-label": "Decrease",
	                      children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                        name: "minus",
	                        size: 15
	                      })
	                    }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                      children: l.qty
	                    }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	                      onClick: () => dispatch({
	                        type: 'SET_QTY',
	                        key: l.key,
	                        qty: l.qty + 1
	                      }),
	                      "aria-label": "Increase",
	                      children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                        name: "plus",
	                        size: 15
	                      })
	                    })]
	                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	                    className: "linkbtn",
	                    onClick: () => dispatch({
	                      type: 'SAVE_LATER',
	                      key: l.key
	                    }),
	                    children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                      name: "heart",
	                      size: 15
	                    }), " Save for later"]
	                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	                    className: "linkbtn linkbtn--danger",
	                    onClick: () => dispatch({
	                      type: 'REMOVE',
	                      key: l.key
	                    }),
	                    children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                      name: "trash",
	                      size: 15
	                    }), " Remove"]
	                  })]
	                })]
	              })]
	            }, l.key))
	          }), savedDetailed.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx(SavedList, {
	            saved: savedDetailed,
	            dispatch: dispatch,
	            inline: true
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("aside", {
	          className: "cartlayout__aside",
	          children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "summary",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	              children: "Order summary"
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
	              className: "summary__coupon",
	              onSubmit: applyCoupon,
	              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                className: "searchbox",
	                style: {
	                  flex: 1
	                },
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "tag"
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                  className: "input",
	                  placeholder: "Coupon code (try SORA10)",
	                  value: coupon,
	                  onChange: e => setCoupon(e.target.value)
	                })]
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	                className: "btn btn-light",
	                type: "submit",
	                children: "Apply"
	              })]
	            }), couponErr && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	              className: "error-text",
	              children: couponErr
	            }), applied && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	              className: "summary__applied",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "checkCircle",
	                size: 15
	              }), " ", applied.code, " \u2014 ", applied.rate * 100, "% off"]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
	              className: "summary__lines",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
	                  children: "Subtotal"
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
	                  children: money(subtotal)
	                })]
	              }), savings > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                className: "is-save",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
	                  children: "Product savings"
	                }), /*#__PURE__*/jsxRuntimeExports.jsxs("dd", {
	                  children: ["\u2212", money(savings)]
	                })]
	              }), discount > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                className: "is-save",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsxs("dt", {
	                  children: ["Coupon (", applied.code, ")"]
	                }), /*#__PURE__*/jsxRuntimeExports.jsxs("dd", {
	                  children: ["\u2212", money(discount)]
	                })]
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
	                  children: "Shipping"
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
	                  children: shipping === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                    className: "free",
	                    children: "Free"
	                  }) : money(shipping)
	                })]
	              })]
	            }), shipping > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	              className: "summary__ship-hint",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "truck",
	                size: 15
	              }), " Add ", money(699 - (subtotal - discount)), " more for free delivery"]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "summary__total",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                children: "Total"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "serif",
	                children: money(total)
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	              to: "/checkout",
	              className: "btn btn-lg btn-block",
	              children: ["Checkout ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "arrowRight",
	                size: 18
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	              to: "/shop",
	              className: "summary__continue",
	              children: "or continue shopping"
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "summary__badges",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "lock",
	                  size: 14
	                }), " Secure"]
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "return",
	                  size: 14
	                }), " Easy returns"]
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                  name: "truck",
	                  size: 14
	                }), " Fast delivery"]
	              })]
	            })]
	          })
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx(ProductRail, {
	      eyebrow: "Add a little extra",
	      title: "Recommended for you",
	      products: getBestsellers(),
	      link: "/shop"
	    })]
	  });
	}
	function SavedList({
	  saved,
	  dispatch,
	  inline
	}) {
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    className: `savedlist ${inline ? 'savedlist--inline' : ''}`,
	    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h3", {
	      className: "serif",
	      style: {
	        fontSize: 'var(--text-xl)',
	        margin: 'var(--sp-8) 0 var(--sp-4)'
	      },
	      children: ["Saved for later (", saved.length, ")"]
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "savedlist__grid",
	      children: saved.map(l => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "savedcard",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	          to: `/product/${l.product.slug}`,
	          className: "savedcard__media",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	            product: l.product
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "savedcard__body",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: `/product/${l.product.slug}`,
	            className: "savedcard__name",
	            children: l.product.name
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "price",
	            children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "now",
	              style: {
	                fontSize: 'var(--text-md)'
	              },
	              children: money(l.product.price)
	            })
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "savedcard__actions",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "btn btn-sm btn-light",
	              onClick: () => dispatch({
	                type: 'MOVE_TO_CART',
	                key: l.key
	              }),
	              children: "Move to cart"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "linkbtn linkbtn--danger",
	              onClick: () => dispatch({
	                type: 'REMOVE_SAVED',
	                key: l.key
	              }),
	              "aria-label": "Remove",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "trash",
	                size: 15
	              })
	            })]
	          })]
	        })]
	      }, l.key))
	    })]
	  });
	}

	const STEPS = ['Contact', 'Shipping', 'Delivery', 'Payment'];
	const DELIVERY = [{
	  id: 'std',
	  label: 'Standard',
	  eta: '3–5 business days',
	  price: 0,
	  note: 'Free'
	}, {
	  id: 'exp',
	  label: 'Express',
	  eta: '1–2 business days',
	  price: 79
	}, {
	  id: 'sched',
	  label: 'Scheduled',
	  eta: 'Pick a date at doorstep',
	  price: 49
	}];
	function Checkout() {
	  const {
	    cartDetailed,
	    subtotal,
	    savings,
	    dispatch
	  } = useStore();
	  const [step, setStep] = reactExports.useState(0);
	  const [delivery, setDelivery] = reactExports.useState('std');
	  const [pay, setPay] = reactExports.useState('upi');
	  const [placed, setPlaced] = reactExports.useState(false);
	  useNavigate();
	  const deliveryFee = DELIVERY.find(d => d.id === delivery)?.price || 0;
	  const shipBase = subtotal >= 699 ? 0 : deliveryFee;
	  const total = Math.max(0, subtotal + shipBase);
	  if (placed) {
	    return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "container section",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "confirm",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "confirm__tick",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "check",
	            size: 40
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "eyebrow",
	          children: "Order confirmed"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
	          className: "serif",
	          children: "Thank you \u2014 your ritual is on its way."
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	          className: "muted",
	          children: ["A confirmation has been sent to your email. Order ", /*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
	            children: ["#SORA-", Math.floor(100000 + Math.random() * 900000)]
	          }), "."]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "confirm__card",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "confirm__row",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              children: "Estimated delivery"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: DELIVERY.find(d => d.id === delivery)?.eta
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "confirm__row",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              children: "Total paid"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: money(total)
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "confirm__row",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              children: "Payment"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: pay === 'cod' ? 'Cash on delivery' : pay.toUpperCase()
	            })]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "confirm__actions",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/account/orders",
	            className: "btn",
	            children: "Track my order"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/shop",
	            className: "btn btn-outline",
	            children: "Continue shopping"
	          })]
	        })]
	      })
	    });
	  }
	  if (!cartDetailed.length) {
	    return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "container section",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "state",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "state-ic",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "bag",
	            size: 32
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	          children: "Your cart is empty"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          children: "Add a few essentials before checking out."
	        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	          to: "/shop",
	          className: "btn",
	          children: "Browse products"
	        })]
	      })
	    });
	  }
	  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
	  const placeOrder = () => {
	    dispatch({
	      type: 'CLEAR_CART'
	    });
	    setPlaced(true);
	    window.scrollTo(0, 0);
	  };
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    className: "checkout",
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "checkout__bar",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container checkout__bar-in",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Logo, {}), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	          className: "checkout__secure",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "lock",
	            size: 15
	          }), " Secure checkout"]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "container checkout__grid",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "checkout__main",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("ol", {
	          className: "stepper",
	          children: STEPS.map((s, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	            className: `stepper__item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`,
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "stepper__num",
	              children: i < step ? /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "check",
	                size: 14
	              }) : i + 1
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "stepper__lbl",
	              children: s
	            })]
	          }, s))
	        }), step === 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
	          className: "cform",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	            className: "serif",
	            children: "Contact information"
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	            className: "muted",
	            children: ["We'll use this to send order updates. ", /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	              to: "/account",
	              className: "inline-link",
	              children: "Log in"
	            }), " for faster checkout."]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "field",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	              className: "label",
	              children: "Email address"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	              className: "input",
	              type: "email",
	              placeholder: "you@email.com"
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "field",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	              className: "label",
	              children: "Phone number"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	              className: "input",
	              type: "tel",
	              placeholder: "+91 98765 43210"
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
	            className: "check",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
	              type: "checkbox",
	              defaultChecked: true
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "check__box",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "check",
	                size: 13
	              })
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              children: "Email me with news and offers"
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	            className: "btn btn-lg",
	            onClick: next,
	            children: ["Continue to shipping ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "arrowRight",
	              size: 18
	            })]
	          })]
	        }), step === 1 && /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
	          className: "cform",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	            className: "serif",
	            children: "Shipping address"
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "grid2",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "field",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                className: "label",
	                children: "First name"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                placeholder: "First name"
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "field",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                className: "label",
	                children: "Last name"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                placeholder: "Last name"
	              })]
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "field",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	              className: "label",
	              children: "Address"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	              className: "input",
	              placeholder: "House no, street, area"
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "field",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	              className: "label",
	              children: "Apartment, landmark (optional)"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	              className: "input",
	              placeholder: "Apartment, landmark"
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "grid3",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "field",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                className: "label",
	                children: "City"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                placeholder: "City"
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "field",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                className: "label",
	                children: "State"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                placeholder: "State"
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "field",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                className: "label",
	                children: "PIN code"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                placeholder: "560001"
	              })]
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "cform__nav",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	              className: "btn btn-ghost",
	              onClick: () => setStep(0),
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "chevronLeft",
	                size: 18
	              }), " Back"]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	              className: "btn btn-lg",
	              onClick: next,
	              children: ["Continue to delivery ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "arrowRight",
	                size: 18
	              })]
	            })]
	          })]
	        }), step === 2 && /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
	          className: "cform",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	            className: "serif",
	            children: "Delivery method"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "optlist",
	            children: DELIVERY.map(d => /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
	              className: `opt ${delivery === d.id ? 'active' : ''}`,
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                type: "radio",
	                name: "delivery",
	                checked: delivery === d.id,
	                onChange: () => setDelivery(d.id)
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "opt__radio"
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                className: "opt__body",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	                  children: d.label
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("em", {
	                  children: d.eta
	                })]
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "opt__price",
	                children: d.price === 0 ? 'Free' : money(d.price)
	              })]
	            }, d.id))
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "cform__nav",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	              className: "btn btn-ghost",
	              onClick: () => setStep(1),
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "chevronLeft",
	                size: 18
	              }), " Back"]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	              className: "btn btn-lg",
	              onClick: next,
	              children: ["Continue to payment ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "arrowRight",
	                size: 18
	              })]
	            })]
	          })]
	        }), step === 3 && /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
	          className: "cform",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	            className: "serif",
	            children: "Payment"
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	            className: "muted",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "lock",
	              size: 14
	            }), " This is a design prototype \u2014 no real payment is processed."]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "optlist",
	            children: [['upi', 'UPI', 'Pay by any UPI app'], ['card', 'Card', 'Credit or debit card'], ['cod', 'Cash on delivery', 'Pay when it arrives']].map(([id, label, note]) => /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
	              className: `opt ${pay === id ? 'active' : ''}`,
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                type: "radio",
	                name: "pay",
	                checked: pay === id,
	                onChange: () => setPay(id)
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "opt__radio"
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                className: "opt__body",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	                  children: label
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("em", {
	                  children: note
	                })]
	              }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: id === 'cod' ? 'truck' : id === 'card' ? 'card' : 'phone',
	                size: 20
	              })]
	            }, id))
	          }), pay === 'card' && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "paycard",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "field",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                className: "label",
	                children: "Card number"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                placeholder: "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022",
	                inputMode: "numeric"
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "grid2",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                className: "field",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                  className: "label",
	                  children: "Expiry"
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                  className: "input",
	                  placeholder: "MM / YY"
	                })]
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	                className: "field",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                  className: "label",
	                  children: "CVV"
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                  className: "input",
	                  placeholder: "\u2022\u2022\u2022",
	                  inputMode: "numeric"
	                })]
	              })]
	            })]
	          }), pay === 'upi' && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "paycard",
	            children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "field",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	                className: "label",
	                children: "UPI ID"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	                className: "input",
	                placeholder: "yourname@upi"
	              })]
	            })
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "cform__nav",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	              className: "btn btn-ghost",
	              onClick: () => setStep(2),
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "chevronLeft",
	                size: 18
	              }), " Back"]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	              className: "btn btn-accent btn-lg",
	              onClick: placeOrder,
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "lock",
	                size: 17
	              }), " Place order \xB7 ", money(total)]
	            })]
	          })]
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("aside", {
	        className: "checkout__aside",
	        children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "summary",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	            children: "Order summary"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "checkout__items",
	            children: cartDetailed.map(l => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "checkout__item",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                className: "checkout__thumb",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	                  product: l.product
	                }), /*#__PURE__*/jsxRuntimeExports.jsx("i", {
	                  className: "checkout__qty",
	                  children: l.qty
	                })]
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	                className: "checkout__meta",
	                children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	                  children: l.product.name
	                }), l.variant && /*#__PURE__*/jsxRuntimeExports.jsx("em", {
	                  children: l.variant
	                })]
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                className: "checkout__lp",
	                children: money(l.product.price * l.qty)
	              })]
	            }, l.key))
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
	            className: "summary__lines",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
	                children: "Subtotal"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
	                children: money(subtotal)
	              })]
	            }), savings > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              className: "is-save",
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
	                children: "Savings"
	              }), /*#__PURE__*/jsxRuntimeExports.jsxs("dd", {
	                children: ["\u2212", money(savings)]
	              })]
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
	                children: "Shipping"
	              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
	                children: shipBase === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	                  className: "free",
	                  children: "Free"
	                }) : money(shipBase)
	              })]
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "summary__total",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              children: "Total"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "serif",
	              children: money(total)
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/cart",
	            className: "summary__continue",
	            children: "Edit cart"
	          })]
	        })
	      })]
	    })]
	  });
	}

	const ORDERS = [{
	  id: 'SORA-582104',
	  date: '18 Aug 2026',
	  status: 'Out for delivery',
	  total: 1847,
	  items: ['sk-vitc', 'nt-protein'],
	  step: 2
	}, {
	  id: 'SORA-573998',
	  date: '02 Aug 2026',
	  status: 'Delivered',
	  total: 848,
	  items: ['hc-argan', 'pc-neemsoap'],
	  step: 3
	}, {
	  id: 'SORA-560771',
	  date: '21 Jul 2026',
	  status: 'Delivered',
	  total: 549,
	  items: ['hw-ashwa'],
	  step: 3
	}];
	const TRACK = ['Order placed', 'Packed', 'Out for delivery', 'Delivered'];
	const NAV = [{
	  id: 'orders',
	  label: 'My orders',
	  icon: 'package'
	}, {
	  id: 'wishlist',
	  label: 'Wishlist',
	  icon: 'heart'
	}, {
	  id: 'addresses',
	  label: 'Addresses',
	  icon: 'mapPin'
	}, {
	  id: 'profile',
	  label: 'Profile',
	  icon: 'user'
	}, {
	  id: 'settings',
	  label: 'Settings',
	  icon: 'settings'
	}];
	function Account() {
	  const {
	    tab = 'orders'
	  } = useParams();
	  const navigate = useNavigate();
	  const [authed, setAuthed] = reactExports.useState(false);
	  const [mode, setMode] = reactExports.useState('login');
	  const {
	    wishlist
	  } = useStore();
	  if (!authed) return /*#__PURE__*/jsxRuntimeExports.jsx(AuthView, {
	    mode: mode,
	    setMode: setMode,
	    onAuth: () => setAuthed(true)
	  });
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "pagehead",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	          className: "crumbs",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/",
	            children: "Home"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "chevronRight",
	            size: 14
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            children: "Account"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
	          className: "serif",
	          children: "Hi, Aditi \uD83D\uDC4B"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          className: "muted",
	          children: "Welcome back to your Sora Life account."
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "container section-sm",
	      style: {
	        paddingTop: 'var(--sp-8)'
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "acct",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("aside", {
	          className: "acct__nav",
	          children: [NAV.map(n => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	            className: `acct__navitem ${tab === n.id ? 'active' : ''}`,
	            onClick: () => navigate(`/account/${n.id}`),
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: n.icon,
	              size: 19
	            }), " ", n.label, n.id === 'wishlist' && wishlist.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "acct__badge",
	              children: wishlist.length
	            })]
	          }, n.id)), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	            className: "acct__navitem acct__logout",
	            onClick: () => setAuthed(false),
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "logout",
	              size: 19
	            }), " Log out"]
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "acct__panel",
	          children: [tab === 'orders' && /*#__PURE__*/jsxRuntimeExports.jsx(Orders, {}), tab === 'wishlist' && /*#__PURE__*/jsxRuntimeExports.jsx(WishTab, {
	            wishlist: wishlist
	          }), tab === 'addresses' && /*#__PURE__*/jsxRuntimeExports.jsx(Addresses, {}), tab === 'profile' && /*#__PURE__*/jsxRuntimeExports.jsx(Profile, {}), tab === 'settings' && /*#__PURE__*/jsxRuntimeExports.jsx(Settings, {})]
	        })]
	      })
	    })]
	  });
	}
	function AuthView({
	  mode,
	  setMode,
	  onAuth
	}) {
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    className: "auth",
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "auth__art",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "auth__art-in",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "eyebrow",
	          style: {
	            color: 'var(--honey-300)'
	          },
	          children: "Sora Life members"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	          className: "serif",
	          style: {
	            color: '#FBF8F1',
	            fontSize: 'var(--text-3xl)',
	            margin: '12px 0'
	          },
	          children: "Your rituals, remembered."
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          style: {
	            color: 'rgba(251,248,241,0.82)'
	          },
	          children: "Save favourites, track orders, reorder in a tap and unlock members-only drops."
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("ul", {
	          className: "auth__perks",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "check",
	              size: 17
	            }), " Faster, saved checkout"]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "check",
	              size: 17
	            }), " Order tracking & history"]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "check",
	              size: 17
	            }), " Early access to new launches"]
	          })]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "auth__form",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "auth__card",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "auth__tabs",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: mode === 'login' ? 'active' : '',
	            onClick: () => setMode('login'),
	            children: "Log in"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: mode === 'signup' ? 'active' : '',
	            onClick: () => setMode('signup'),
	            children: "Create account"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
	          onSubmit: e => {
	            e.preventDefault();
	            onAuth();
	          },
	          children: [mode === 'signup' && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "field",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	              className: "label",
	              children: "Full name"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	              className: "input",
	              placeholder: "Your name",
	              required: true
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "field",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	              className: "label",
	              children: "Email"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	              className: "input",
	              type: "email",
	              placeholder: "you@email.com",
	              required: true
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "field",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	              className: "label",
	              children: "Password"
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	              className: "input",
	              type: "password",
	              placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
	              required: true
	            })]
	          }), mode === 'login' && /*#__PURE__*/jsxRuntimeExports.jsx("a", {
	            href: "#",
	            className: "auth__forgot",
	            children: "Forgot password?"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "btn btn-lg btn-block",
	            type: "submit",
	            children: mode === 'login' ? 'Log in' : 'Create account'
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "auth__or",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            children: "or"
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "auth__social",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "btn btn-light btn-block",
	            onClick: onAuth,
	            children: "Continue with Google"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "btn btn-light btn-block",
	            onClick: onAuth,
	            children: "Continue with Apple"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          className: "auth__guest",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/shop",
	            children: "Continue as guest \u2192"
	          })
	        })]
	      })
	    })]
	  });
	}
	function Orders() {
	  const [track, setTrack] = reactExports.useState(null);
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	      className: "serif acct__h",
	      children: "My orders"
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "orderlist",
	      children: ORDERS.map(o => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "ordercard",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "ordercard__head",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: o.id
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	              className: "muted",
	              children: [" \xB7 ", o.date]
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: `badge ${o.status === 'Delivered' ? '' : 'badge-best'}`,
	            children: o.status
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "ordercard__body",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	            className: "ordercard__thumbs",
	            children: o.items.map(id => /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "ordercard__thumb",
	              children: /*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	                product: productById[id]
	              })
	            }, id))
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "ordercard__meta",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	              className: "muted",
	              children: [o.items.length, " item", o.items.length > 1 ? 's' : '']
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	              children: money(o.total)
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: "ordercard__actions",
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "btn btn-sm btn-light",
	              onClick: () => setTrack(track === o.id ? null : o.id),
	              children: track === o.id ? 'Hide tracking' : 'Track order'
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	              className: "btn btn-sm btn-ghost",
	              children: "Reorder"
	            })]
	          })]
	        }), track === o.id && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	          className: "track",
	          children: TRACK.map((t, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            className: `track__step ${i <= o.step ? 'done' : ''}`,
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "track__dot",
	              children: i <= o.step ? /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	                name: "check",
	                size: 12
	              }) : ''
	            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	              className: "track__lbl",
	              children: t
	            })]
	          }, t))
	        })]
	      }, o.id))
	    })]
	  });
	}
	function WishTab({
	  wishlist
	}) {
	  const items = wishlist.map(id => productById[id]).filter(Boolean);
	  if (!items.length) return /*#__PURE__*/jsxRuntimeExports.jsx(EmptyPanel, {
	    icon: "heart",
	    title: "No saved items yet",
	    text: "Tap the heart on any product to save it here.",
	    cta: "/shop",
	    ctaLabel: "Explore products"
	  });
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h2", {
	      className: "serif acct__h",
	      children: ["Wishlist (", items.length, ")"]
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "acct__wishgrid",
	      children: items.map(p => /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	        to: `/product/${p.slug}`,
	        className: "acct__wishcard",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(ProductImage, {
	          product: p
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "acct__wishname",
	          children: p.name
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "price",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            className: "now",
	            style: {
	              fontSize: 'var(--text-md)'
	            },
	            children: money(p.price)
	          })
	        })]
	      }, p.id))
	    })]
	  });
	}
	function Addresses() {
	  const addrs = [{
	    id: 1,
	    name: 'Aditi Sharma',
	    line: '204, Rosewood Residency, Indiranagar',
	    city: 'Bengaluru 560038',
	    phone: '+91 98765 43210',
	    default: true
	  }, {
	    id: 2,
	    name: 'Aditi Sharma (Work)',
	    line: 'WeWork Prestige, MG Road',
	    city: 'Bengaluru 560001',
	    phone: '+91 98765 43210',
	    default: false
	  }];
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "acct__panelhead",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	        className: "serif acct__h",
	        children: "Saved addresses"
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	        className: "btn btn-sm",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "plus",
	          size: 16
	        }), " Add new"]
	      })]
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "addrgrid",
	      children: addrs.map(a => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: `addrcard ${a.default ? 'default' : ''}`,
	        children: [a.default && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "badge badge-best",
	          children: "Default"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	          children: a.name
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	          className: "muted",
	          children: [a.line, /*#__PURE__*/jsxRuntimeExports.jsx("br", {}), a.city, /*#__PURE__*/jsxRuntimeExports.jsx("br", {}), a.phone]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "addrcard__actions",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "linkbtn",
	            children: "Edit"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	            className: "linkbtn linkbtn--danger",
	            children: "Remove"
	          })]
	        })]
	      }, a.id))
	    })]
	  });
	}
	function Profile() {
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	      className: "serif acct__h",
	      children: "Profile"
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "surface pad-lg",
	      style: {
	        maxWidth: 560
	      },
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "grid2",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "field",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	            className: "label",
	            children: "First name"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	            className: "input",
	            defaultValue: "Aditi"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "field",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	            className: "label",
	            children: "Last name"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	            className: "input",
	            defaultValue: "Sharma"
	          })]
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "field",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	          className: "label",
	          children: "Email"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	          className: "input",
	          type: "email",
	          defaultValue: "aditi@email.com"
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "field",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
	          className: "label",
	          children: "Phone"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
	          className: "input",
	          type: "tel",
	          defaultValue: "+91 98765 43210"
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
	        className: "btn",
	        style: {
	          marginTop: 8
	        },
	        children: "Save changes"
	      })]
	    })]
	  });
	}
	function Settings() {
	  const rows = [['Order updates', 'Delivery and shipping notifications', true], ['New launches', 'Be first to know about new products', true], ['Offers & promotions', 'Occasional deals and member perks', false], ['SMS updates', 'Get order texts on your phone', false]];
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
	      className: "serif acct__h",
	      children: "Settings"
	    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "surface pad-lg",
	      style: {
	        maxWidth: 620
	      },
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	        style: {
	          fontSize: 'var(--text-md)',
	          marginBottom: 12
	        },
	        children: "Notifications"
	      }), rows.map(([t, s, on]) => /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
	        className: "toggle-row",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
	            children: t
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("em", {
	            children: s
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: `switch ${on ? 'on' : ''}`,
	          children: /*#__PURE__*/jsxRuntimeExports.jsx("i", {})
	        })]
	      }, t)), /*#__PURE__*/jsxRuntimeExports.jsx("hr", {
	        className: "hr",
	        style: {
	          margin: '20px 0'
	        }
	      }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	        className: "linkbtn linkbtn--danger",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	          name: "trash",
	          size: 15
	        }), " Delete account"]
	      })]
	    })]
	  });
	}
	function EmptyPanel({
	  icon,
	  title,
	  text,
	  cta,
	  ctaLabel
	}) {
	  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	    className: "state",
	    style: {
	      padding: 'var(--sp-12) var(--sp-4)'
	    },
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	      className: "state-ic",
	      children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	        name: icon,
	        size: 30
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	      children: title
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	      children: text
	    }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	      to: cta,
	      className: "btn",
	      children: ctaLabel
	    })]
	  });
	}

	function Wishlist() {
	  const {
	    wishlist,
	    addToCart
	  } = useStore();
	  const items = wishlist.map(id => productById[id]).filter(Boolean);
	  if (!items.length) {
	    return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	      className: "container section",
	      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "state",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
	          className: "state-ic",
	          children: /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "heart",
	            size: 32
	          })
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
	          children: "Your wishlist is empty"
	        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
	          children: "Save the products you love by tapping the heart \u2014 they'll live here for later."
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs(Link, {
	          to: "/shop",
	          className: "btn",
	          children: ["Find something you love ", /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "arrowRight",
	            size: 18
	          })]
	        })]
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(ProductRail, {
	        eyebrow: "Get inspired",
	        title: "Popular right now",
	        products: getBestsellers(),
	        link: "/shop"
	      })]
	    });
	  }
	  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
	    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "pagehead",
	      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	        className: "container",
	        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("nav", {
	          className: "crumbs",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
	            to: "/",
	            children: "Home"
	          }), /*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	            name: "chevronRight",
	            size: 14
	          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
	            children: "Wishlist"
	          })]
	        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	          className: "wishhead",
	          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
	              className: "serif",
	              children: "Your wishlist"
	            }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
	              className: "muted",
	              children: [items.length, " saved ", items.length === 1 ? 'item' : 'items', "."]
	            })]
	          }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
	            className: "btn btn-outline",
	            onClick: () => items.forEach(p => p.stock > 0 && addToCart(p)),
	            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Icon, {
	              name: "bag",
	              size: 18
	            }), " Add all to cart"]
	          })]
	        })]
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	      className: "container section-sm",
	      style: {
	        paddingTop: 'var(--sp-8)'
	      },
	      children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
	        className: "pgrid",
	        children: items.map(p => /*#__PURE__*/jsxRuntimeExports.jsx(ProductCard, {
	          product: p
	        }, p.id))
	      })
	    }), /*#__PURE__*/jsxRuntimeExports.jsx(ProductRail, {
	      eyebrow: "More to love",
	      title: "You might also like",
	      products: getBestsellers(),
	      link: "/shop"
	    })]
	  });
	}

	function App() {
	  return /*#__PURE__*/jsxRuntimeExports.jsx(Routes, {
	    children: /*#__PURE__*/jsxRuntimeExports.jsxs(Route, {
	      element: /*#__PURE__*/jsxRuntimeExports.jsx(Layout, {}),
	      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        index: true,
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Home, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "/shop",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Shop, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "/category/:slug",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Category, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "/product/:slug",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Product, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "/cart",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Cart, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "/checkout",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Checkout, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "/account",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Account, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "/account/:tab",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Account, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "/wishlist",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(Wishlist, {})
	      }), /*#__PURE__*/jsxRuntimeExports.jsx(Route, {
	        path: "*",
	        element: /*#__PURE__*/jsxRuntimeExports.jsx(NotFound, {})
	      })]
	    })
	  });
	}

	class ErrorBoundary extends React.Component {
	  constructor(p) {
	    super(p);
	    this.state = {
	      err: null
	    };
	  }
	  static getDerivedStateFromError(err) {
	    return {
	      err
	    };
	  }
	  componentDidCatch(err, info) {
	    console.error('BOUNDARY', err && err.message, info && info.componentStack);
	  }
	  render() {
	    if (this.state.err) return /*#__PURE__*/jsxRuntimeExports.jsx("pre", {
	      style: {
	        padding: 20,
	        color: '#c00',
	        whiteSpace: 'pre-wrap'
	      },
	      children: String(this.state.err && this.state.err.stack)
	    });
	    return this.props.children;
	  }
	}
	client.createRoot(document.getElementById('root')).render(/*#__PURE__*/jsxRuntimeExports.jsx(React.StrictMode, {
	  children: /*#__PURE__*/jsxRuntimeExports.jsx(BrowserRouter, {
	    children: /*#__PURE__*/jsxRuntimeExports.jsx(StoreProvider, {
	      children: /*#__PURE__*/jsxRuntimeExports.jsx(ErrorBoundary, {
	        children: /*#__PURE__*/jsxRuntimeExports.jsx(App, {})
	      })
	    })
	  })
	}));

})();
//# sourceMappingURL=bundle.js.map
