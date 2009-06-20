/*
 * jQuery Simple Templates plugin 1.1.1
 *
 * http://andrew.hedges.name/tmpl/
 * http://docs.jquery.com/Plugins/Tmpl
 *
 * Copyright (c) 2008 Andrew Hedges, andrew@hedges.name
 *
 * Usage: $.tmpl('<div class="#{classname}">#{content}</div>', { 'classname' : 'my-class', 'content' : 'My content.' });
 *        $.tmpl('<div class="#{1}">#{0}</div>', 'My content', 'my-class');   // placeholder order not important
 *
 * The changes for version 1.1 were inspired by the discussion at this thread:
 *   http://groups.google.com/group/jquery-ui/browse_thread/thread/45d0f5873dad0178/0f3c684499d89ff4
 * 
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */

(function($) {
	// regular expression for matching our placeholders; e.g., #{my-cLaSs_name77}
	var regx = /#\{([^{}]*)}/g;

	$.extend({
		// public interface: $.tmpl
		tmpl : function(tmpl) {
			// default to doing no harm
			tmpl = tmpl || '';
			var vals = (2 === arguments.length && 'object' === typeof arguments[1] ? arguments[1] : Array.prototype.slice.call(arguments,1));
			// function to making replacements
			var repr = function (str, match) {
				return typeof vals[match] === 'string' || typeof vals[match] === 'number' ? vals[match] : str;
			};
    		
			return tmpl.replace(regx, repr);
		}
	});
})(jQuery);
