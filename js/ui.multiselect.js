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
 *	ui.draggable.js
 * ui.droppable.js
 *
 * Optional:
 * localization (http://plugins.jquery.com/project/localisation)
 * scrollTo (http://plugins.jquery.com/project/ScrollTo)
 * 
 * Todo:
 *  Make batch actions faster
 *  Implement dynamic insertion through remote calls
 */

(function($) {

$.widget("ui.multiselect", {
	_init: function() {
		this.element.hide();
		this.id = this.element.attr("id");
		this.busy = false;  // busy state
		this.container = $('<div class="ui-multiselect ui-helper-clearfix ui-widget"></div>').insertAfter(this.element);
		this.selectedContainer = $('<div class="ui-widget-content list-container selected"></div>').appendTo(this.container);
		this.availableContainer = $('<div class="ui-widget-content list-container available"></div>').appendTo(this.container);
		this.selectedActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="count">0'+$.ui.multiselect.locale.itemsCount+'</span><a href="#" class="remove-all">'+$.ui.multiselect.locale.removeAll+'</a></div>').appendTo(this.selectedContainer);
		this.availableActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="busy">'+$.ui.multiselect.locale.busy+'</span><input type="text" class="search empty ui-widget-content ui-corner-all"/><a href="#" class="add-all">'+$.ui.multiselect.locale.addAll+'</a></div>').appendTo(this.availableContainer);
		this.selectedList = $('<ul class="list selected connected-list"><li class="ui-helper-hidden-accessible"></li></ul>').bind('selectstart', function(){return false;}).appendTo(this.selectedContainer);
		this.availableList = $('<ul class="list available connected-list"><li class="ui-helper-hidden-accessible"></li></ul>').bind('selectstart', function(){return false;}).appendTo(this.availableContainer);
		
		var that = this;

		// initialize data cache
		this.availableList.data('cache', {});
		this.selectedList.data('cache', {});
		
		if ( !this.options.animated ) {
			this.options.show = 'show';
			this.options.hide = 'hide';
		}
		
		// make selection draggable/droppable
		this.container.find("ul.selected").droppable({
			accept: '.ui-multiselect ul.available li.ui-element',
			hoverClass: 'ui-state-highlight',
			drop: function(event, ui) {
				that._setSelected(ui.draggable, true);
			}
		});
		this.container.find("ul.available").droppable({
			accept: '.ui-multiselect ul.selected li.ui-element',
			hoverClass: 'ui-state-highlight',
			drop: function(event, ui) {
				that._setSelected(ui.draggable, false);
			}
		});
		
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

		// set dimensions
		this.container.width(this.element.width()+1);
		this.selectedContainer.width(Math.floor(this.element.width()*this.options.dividerLocation));
		this.availableContainer.width(Math.floor(this.element.width()*(1-this.options.dividerLocation)));
		// set max width of search input dynamically
		this.availableActions.find('input').width(Math.max(this.availableActions.width() - this.availableActions.find('a.add-all').width() - 30, 20));
		// fix list height to match <option> depending on their individual header's heights
		this.selectedList.height(Math.max(this.element.height()-this.selectedActions.height(),1));
		this.availableList.height(Math.max(this.element.height()-this.availableActions.height(),1));

		// init lists
		this._populateLists(this.element.find('option'));
	},
	destroy: function() {
		this.container.remove();
		this.element.show();

		$.widget.prototype.destroy.apply(this, arguments);
	},
	_populateLists: function(options) {
		this._setBusy(true);
	
		var that = this;
		// do this async so the browser actually display the waiting message
		setTimeout(function() {
			$(options.each(function(i) {
				var list = (this.selected ? that.selectedList : that.availableList);
		      var item = that._getOptionNode(this).appendTo(list).show();
				that._applyItemState(item, this.selected);
				item.data('idx', i);

				// cache
				list.data('cache')[item.data('optionLink').val()] = item;
		    }));
		
			// update count
			that._setBusy(false);
			that._updateCount();
		}, 10);
	},
	_updateCount: function() {
		if (this.busy) return;
		// count only visible <li> (less .ui-helper-hidden*)
		var count = this.selectedList.children('li:not(.ui-helper-hidden-accessible):visible').size();
		this.selectedContainer.find('span.count').text(count+" "+$.ui.multiselect.locale.itemsCount);
	},
	_getOptionNode: function(option) {
		option = $(option);
		var node = $('<li class="ui-state-default ui-element"><span class="ui-icon"/>'+option.text()+'<a href="#" class="action"><span class="ui-corner-all ui-icon"/></a></li>').hide();
		node.data('optionLink', option);
		return node;
	},
	// clones an item with 
	// didn't find a smarter away around this (m
	// now using cache to speed up the process (yr)
	_cloneWithData: function(clonee, cacheName) {
		var id = clonee.data('optionLink').val();
		var selected = ('selected' == cacheName);
		var list = (selected ? this.selectedList : this.availableList);
		var clone = list.data('cache')[id];

		if (!clone) {
			clone = clonee.clone().hide();
			this._applyItemState(clone, selected);
			// update cache
			list.data('cache')[id] = clone;
			// need this here because it is needed in _getSuccessorNode
			clone.data('idx', clonee.data('idx'));

			var succ = this.options.sortable ? this._getSuccessorNode(clone, list) : null;
			if (succ) {
				clone.insertBefore(succ);
			} else {
				list.append(clone);
			}
		} else {
			// update idx
			clone.data('idx', clonee.data('idx'));
		}
		// update <option> and idx
		clone.data('optionLink', clonee.data('optionLink'));
		return clone;
	},
	_batchSelect: function(elements, state) {
		this._setBusy(true);

		var that = this;
		// do this async so the browser actually display the waiting message
		setTimeout(function() {
			var _backup = {
				animated: that.options.animated,
				hide: that.options.hide,
				show: that.options.show
			};

			that.options.animated = null;
			that.options.hide = 'hide';
			that.options.show = 'show';

			elements.each(function(i,element) {
				that._setSelected($(element), state);
			});

			// filter available items
			if (!state) that._filter(that.availableActions.find('input'), that.availableList.find('li.ui-element'));

			// restore
			$.extend(that.options, _backup);

			that._setBusy(false);
			that._updateCount();
		}, 10);
	},
	// find the best successor the given item in the specified list
	_getSuccessorNode: function(item, list) {
		// look for successor based on initial option index
		var items = list.find('li.ui-element'), comparator = this.options.nodeComparator;
		var itemsSize = items.size();

		// no successor, list is null
		if (items.size() == 0) return null;

		var succ, i = Math.min(item.data('idx'),itemsSize-1), direction = comparator(item, $(items[i]));

		// TODO: test needed for dynamic list populating
		if ( direction ) {
			// quick checks
			if (0>direction && 0>=i) {
				succ = items[0];
			} else if (0<direction && itemsSize-1<=i) {
				i++;
				succ = null;
			} else {
				while (i>=0 && i<items.length) {
					direction > 0 ? i++ : i--;
					if (i<0) {
						succ = item[0]
					}
					if ( direction != comparator(item, $(items[i])) ) {
						// going up, go back one item down, otherwise leave as is
						succ = items[direction > 0 ? i : i+1];
						break;
					}
				}
			}
		} else {
			succ = items[i];
		}
		// update idx
		item.data('idx', i);
	
		return succ;
	},
	_setSelected: function(item, selected) {
		var that = this;
		item.data('optionLink').attr('selected', selected);

		if (selected) {
			// retrieve associatd or cloned item
			var selectedItem = this._cloneWithData(item, 'selected').hide();
			selectedItem[this.options.show](this.options.animated);
			item.addClass('shadowed')[this.options.hide](this.options.animated, function() { that._updateCount(); });
			
			return selectedItem;
		} else {
			// retrieve associated or clone the item
			var availableItem = this._cloneWithData(item, 'available').hide();
			item[this.options.hide](this.options.animated, function() { that._updateCount() });
			availableItem.removeClass('shadowed');
			if (!availableItem.is('.filtered')) availableItem[this.options.show](this.options.animated);
			
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
			item.children('span').addClass('ui-helper-hidden').removeClass('ui-icon');
			item.find('a.action span').addClass('ui-icon-minus').removeClass('ui-icon-plus');
			this._registerRemoveEvents(item.find('a.action'));
			
		} else {
			item.children('span').addClass('ui-helper-hidden').removeClass('ui-icon');
			item.find('a.action span').addClass('ui-icon-plus').removeClass('ui-icon-minus');
			this._registerAddEvents(item.find('a.action'));
		}
		
		this._registerHoverEvents(item);

		return item;
	},
	// apply filter and return elements
	_filter: function(input, elements) {
		var term = $.trim( input.val().toLowerCase() );
		
		if ( !term ) {
			elements.removeClass('filtered');
		} else {
			elements.each(function(i,element) {
				element = $(element);
				element[(element.text().toLowerCase().indexOf(term)>=0 ? 'remove' : 'add')+'Class']('filtered');
			});
		}

		return elements.not('.filtered, .shadowed').show().end().filter('.filtered, .shadowed').hide();
;
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
			// ignore if busy...
			if (!this.busy) that._setSelected($(this).parent(), true);
			return false;
		})
		// make draggable
		.each(function() {
			$(this).parent().draggable({
				//connectToSortable: that.container.find('ul.selected'),
				helper: function() {
					var clone = $(this).clone().width($(this).width());
					clone.find('a').remove();
					$('#debug').text('Dragging element ' + clone[0].tagName + " class " + clone[0].className );
					return clone;
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
			// ignore if busy...
			if (!this.busy) that._setSelected($(this).parent(), false);
			return false;
		})
		// make draggable
		.each(function() {
			$(this).parent().draggable({
				helper: function() {
					var clone = $(this).clone().width($(this).width());
					clone.find('a').remove();
					return clone;
				},
				appendTo: that.container,
				containment: that.container,
				revert: 'invalid'
	    });
		});
 	},
	_registerSearchEvents: function(input) {
		var that = this;
		var searchUrl = this.options.remoteUrl,
		    delay = Math.max(this.options.searchDelay,1),
		    previousValue = input.val(), timer;
	
		var _searchNow = function(force) {
			// TODO : implement this
			var value = input.val();
			if (value != previousValue || force) {
				//that._setBusy(true);

				if (searchUrl) {				
					alert( "Remote Searching... " + value);
				} else {
					that._filter(input, that.availableList.children('li.ui-element'));
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
		})
		;
		//_searchNow(true);
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
