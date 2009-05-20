/*
 * jQuery UI Multiselect
 *
 * Authors:
 *  Michael Aufreiter (quasipartikel.at)
 *  Yanick Rochon (yanick.rochon[at]gmail[dot]com)
 * 
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 * 
 * http://www.quasipartikel.at/multiselect/
 *
 * 
 * Depends:
 *	ui.core.js
 *	ui.sortable.js
 *
 * Optional:
 * localization (http://plugins.jquery.com/project/localisation)
 * scrollTo (http://plugins.jquery.com/project/ScrollTo)
 * 
 * Todo:
 *  Make batch actions faster
 *  Implement dynamic insertion through remote calls
 */

if ( !String.prototype.contains ) {
	/* String.contains - taken from Mootools (default) */
	String.prototype.contains = function(string, separator) {
		return (separator) ? (separator + this + separator).indexOf(separator + string + separator) > -1 : this.indexOf(string) > -1;
	};
}

(function($) {

$.widget("ui.multiselect", {
	_init: function() {
		this.element.hide();
		this.id = this.element.attr("id");
		this.busy = false;  // busy state
		this.container = $('<div class="ui-multiselect ui-helper-clearfix ui-widget"></div>').insertAfter(this.element);
		this.selectedContainer = $('<div class="selected"></div>').appendTo(this.container);
		this.availableContainer = $('<div class="available"></div>').appendTo(this.container);
		this.selectedActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="count">0'+$.ui.multiselect.locale.itemsCount+'</span><a href="#" class="remove-all">'+$.ui.multiselect.locale.removeAll+'</a></div>').appendTo(this.selectedContainer);
		this.availableActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="busy">'+$.ui.multiselect.locale.busy+'</span><input type="text" class="search empty ui-widget-content ui-corner-all"/><a href="#" class="add-all">'+$.ui.multiselect.locale.addAll+'</a></div>').appendTo(this.availableContainer);
		this.selectedList = $('<ul class="selected connected-list"><li class="ui-helper-hidden-accessible"></li></ul>').bind('selectstart', function(){return false;}).appendTo(this.selectedContainer);
		this.availableList = $('<ul class="available connected-list"><li class="ui-helper-hidden-accessible"></li></ul>').bind('selectstart', function(){return false;}).appendTo(this.availableContainer);
		
		var that = this;

		// set dimensions
		this.container.width(this.element.width()+1);
		this.selectedContainer.width(Math.floor(this.element.width()*this.options.dividerLocation));
		this.availableContainer.width(Math.floor(this.element.width()*(1-this.options.dividerLocation)));

		// set max with of search input dynamically
		this.availableActions.find('input').width(Math.max(this.availableActions.width() - this.availableActions.find('a.add-all').width() - 40, 20));
		// fix list height to match <option> depending on their individual header's heights
		this.selectedList.height(Math.max(this.element.height()-this.selectedActions.height(),1));
		this.availableList.height(Math.max(this.element.height()-this.availableActions.height(),1));

		// initialize data cache
		this.availableList.data('cache', {});
		this.selectedList.data('cache', {});
		
		if ( !this.options.animated ) {
			this.options.show = 'show';
			this.options.hide = 'hide';
		}
		
		// init lists
		this._populateLists(this.element.find('option'));
		
		// make selection sortable
		if (this.options.sortable) {
			$("ul.selected").sortable({
				placeholder: 'ui-state-highlight',
				axis: 'y',
				update: function(event, ui) {
					// apply the new sort order to the original selectbox
					that.selectedList.find('li').each(function() {
						if ($(this).data('optionLink'))
							$(this).data('optionLink').remove().appendTo(that.element);
					});
				},
				receive: function(event, ui) {
					that._updateCount();

					// workaround, because there's no way to reference 
					// the new element, see http://dev.jqueryui.com/ticket/4303
					that.selectedList.children('.ui-draggable').each(function() {
						$(this).removeClass('ui-draggable');
						$(this).data('optionLink', ui.item.data('optionLink'));
						$(this).data('idx', ui.item.data('idx'));
						that._applyItemState($(this), true);
					});
			
					// workaround according to http://dev.jqueryui.com/ticket/4088
					setTimeout(function() { ui.item.remove(); }, 1);
				}
			});
		}
		
		// set up livesearch
		if (this.options.searchable) {
			this._registerSearchEvents(this.availableContainer.find('input.search'));
		} else {
			this.availableContainer.find('input.search').hide();
		}
		this.availableContainer.find('.busy').hide();
		
		// batch actions
		this.container.find(".remove-all").bind('click.multiselect', function() {
			that._batchSelect(that.selectedList.children('li.ui-element:visible'), false);	
			return false;
		});
		this.container.find(".add-all").bind('click.multiselect', function() {
			that._batchSelect(that.availableList.children('li.ui-element:visible'), true);	
			return false;
		});
	},
	destroy: function() {
		this.container.remove();
		this.element.show();

		$.widget.prototype.destroy.apply(this, arguments);
	},
	_populateLists: function(options) {
		//this.selectedList.children('.ui-element').remove();
		//this.availableList.children('.ui-element').remove();

		var that = this;
		var items = $(options.each(function() {
	      var item = that._getOptionNode(this).appendTo(this.selected ? that.selectedList : that.availableList).show();
			that._applyItemState(item, this.selected);
			item.data('idx', i);
	    }));
		
		// update count
		this._updateCount();
	},
	_updateCount: function() {
		if (this.busy) return;
		// count only visible <li> (less .ui-helper-hidden*)
		var count = this.selectedList.children('li:not(.ui-helper-hidden-accessible):visible').size();
		this.selectedContainer.find('span.count').text(count+" "+$.ui.multiselect.locale.itemsCount);
	},
	_getOptionNode: function(option) {
		option = $(option);
		var node = $('<li class="ui-state-default ui-element" title="'+option.text()+'"><span class="ui-icon"/>'+option.text()+'<a href="#" class="action"><span class="ui-corner-all ui-icon"/></a></li>').hide();
		node.data('optionLink', option);
		return node;
	},
	// clones an item with 
	// didn't find a smarter away around this
	// now using cache to speed up the process
	_cloneWithData: function(clonee, cacheName) {
		var id = clonee.data('optionLink').val();
		var selected = ('selected' == cacheName);
		var cache = (selected ? this.selectedList : this.availableList).data('cache');
		var clone = cache[id];
		if (!clone) {
			clone = clonee.clone();
			clone.data('optionLink', clonee.data('optionLink'));

			this._applyItemState(clone, selected);
			// update cache
			cache[id] = clone;
		}
		// update idx
		clone.data('idx', clonee.data('idx'));
		return clone;
	},
	_batchSelect: function(elements, state) {
		this._setBusy(true);

		alert( "ok ");

		var that = this;
		var _backup = {
			animated: this.options.animated,
			hide: this.options.hide,
			show: this.options.show
		};

		this.options.animated = null;
		this.options.hide = 'hide';
		this.options.show = 'show';

		elements.each(function(i,element) {
			that._setSelected($(element), state);
		});

		// restore
		$.extend(this.options, _backup);

		this._setBusy(false);
		this._updateCount();
	},
	_setSelected: function(item, selected) {
		var that = this;
		item.data('optionLink').attr('selected', selected);

		if (selected) {
			// clone the item
			var selectedItem = this._cloneWithData(item, 'selected').data('itemLink', item);
			selectedItem.appendTo(this.selectedList).hide()[this.options.show](this.options.animated);
			item[this.options.hide](this.options.animated, function() { that._updateCount(); });
			
			return selectedItem;
		} else {
			// retrieve associated or clone the item
			// TODO : remove itemLink in favor of the cache (perhaps move sort algorithm to a separate function)
			var availableItem = item.data('itemLink');
			if (!availableItem) {
				// look for successor based on initial option index
				var items = this.availableList.find('li'), comparator = this.options.nodeComparator;
				var succ = null, i = Math.min(item.data('idx'),items.size()-1), direction = comparator(item, $(items[i]));

				// TODO: test needed for dynamic list populating
				if ( direction ) {
					while (i>=0 && i<items.length) {
						direction > 0 ? i++ : i--;
						if ( direction != comparator(item, $(items[i])) ) {
							// going up, go back one item down, otherwise leave as is
							succ = items[direction > 0 ? i : i+1];
							break;
						}
					}
					// update idx
					item.data('idx', i);
				} else {
					succ = items[i];
				}
			
				availableItem = this._cloneWithData(item, 'available').hide();
				succ ? availableItem.insertBefore($(succ)) : availableItem.appendTo(this.availableList);
			}
			item[this.options.hide](this.options.animated, function() { that._updateCount() });
			availableItem[this.options.show](this.options.animated);
			
			return availableItem;
		}
	},
	_setBusy: function(state) {
		var input = this.availableContainer.find('input.search');
		var busy = this.availableContainer.find('.busy');
	
		this.container.find("a.remove-all, a.add-all")[state ? 'hide' : 'show']();
		if (state) {
			input.data('hasFocus', document.activeElement == input[0]).hide();
			busy.show();
		} else {
			input.show();
			busy.hide();
			if (input.data('hasFocus')) input.focus();
		}

		this.busy = state;
	},
	_applyItemState: function(item, selected) {
		if (selected) {
			if (this.options.sortable)
				item.children('span').addClass('ui-icon-arrowthick-2-n-s').removeClass('ui-helper-hidden').addClass('ui-icon');
			else
				item.children('span').removeClass('ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden').removeClass('ui-icon');
			item.find('a.action span').addClass('ui-icon-minus').removeClass('ui-icon-plus');
			this._registerRemoveEvents(item.find('a.action'));
			
		} else {
			item.children('span').removeClass('ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden').removeClass('ui-icon');
			item.find('a.action span').addClass('ui-icon-plus').removeClass('ui-icon-minus');
			this._registerAddEvents(item.find('a.action'));
		}
		
		this._registerHoverEvents(item);

		return item;
	},
	// taken from John Resig's liveUpdate script
	// optimized for the multiselect context (yr)
	_filter: function(input, elements) {
		var term = $.trim( input.val().toLowerCase() );
		
		if ( !term ) {
			elements.show();
		} else {
			elements.each(function(i,element) {
				$(element)[element.innerHTML.toLowerCase().contains(term) ? 'show' : 'hide']();
			});
		}
	},
	_registerHoverEvents: function(elements) {
		elements.removeClass('ui-state-hover')
		.bind('mouseover.multiselect', function() {
			$(this).addClass('ui-state-hover');
		})
		.bind('mouseout.multiselect', function() {
			$(this).removeClass('ui-state-hover');
		});
	},
	_registerAddEvents: function(elements) {
		var that = this;
		elements.bind('click.multiselect', function() {
			var item = that._setSelected($(this).parent(), true);
			return false;
		})
		// make draggable
		.each(function() {
			$(this).parent().draggable({
	      connectToSortable: 'ul.selected',
				helper: function() {
					var selectedItem = that._cloneWithData($(this)).width($(this).width() - 50);
					selectedItem.width($(this).width());
					return selectedItem;
				},
				appendTo: that.container,
				containment: that.container,
				revert: 'invalid'
	    });
		});
	},
	_registerRemoveEvents: function(elements) {
		var that = this;
		elements.bind('click.multiselect', function() {
			that._setSelected($(this).parent(), false);
			return false;
		});
 	},
	_registerSearchEvents: function(input) {
		var that = this;
		var searchUrl = this.options.remoteUrl,
		    delay = Math.max(this.options.searchDelay,1),
		    previousValue = input.val(), timer;
	
		var _searchNow = function() {
			// TODO : implement this
			var value = input.val();
			if (value != previousValue) {
				//that._setBusy(true);

				if (searchUrl) {				
					alert( "Remote Searching... " + value);
				} else {
					that._filter(input, that.availableList.children('li'));
				}

				previousValue = value;
				//that._setBusy(false);
			}
		};

		input.parents('form').submit(function(){
			return false;
		})
		.bind('focus.multiselect', function() {
			$(this).addClass('ui-state-active');
		})
		.bind('blur.multiselect', function() {
			$(this).removeClass('ui-state-active');
		})
		.bind('keydown.multiselect keypress.multiselect', function(e) {
			if (timer) clearTimeout(timer);
			switch (e.which) {
				case 13:   // enter
					_searchNow();
					return false;

				default:
					timer = setTimeout(function() { _searchNow(); }, delay);
			}
		})//.trigger('keypress.multiselect')
		;
	}
});
		
$.extend($.ui.multiselect, {
	defaults: {
		// sortable
		sortable: true,
		// searchable
		searchable: true,
		searchDelay: 400,
		remoteUrl: null,
		remoteParams: {},
		// animated
		animated: 'fast',
		show: 'slideDown',
		hide: 'slideUp',
		// ui
		dividerLocation: 0.6,
		// callbacks
		nodeComparator: function(node1,node2) {
			var text1 = node1.text(),
			    text2 = node2.text();
			return text1 == text2 ? 0 : (text1 < text2 ? -1 : 1);
		},
		nodeInserted: function(event,ui,data) {}
	},
	locale: {
		addAll:'Add all',
		removeAll:'Remove all',
		itemsCount:'items selected',
		busy:'please wait...'
	}
});

})(jQuery);
