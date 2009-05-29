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
 * http://yanickrochon.uuuq.com/multiselect/
 *
 * 
 * Depends:
 *	 ui.core.js
 *	 ui.draggable.js
 *  ui.droppable.js
 *  jquery.blockUI (http://github.com/malsup/blockui/)
 *
 * Optional:
 *  localization (http://plugins.jquery.com/project/localisation)
 *
 * Notes:
 *  The strings in this plugin use a templating engine to enable localization
 *  and allow flexibility in the messages. Read the documentation for more details. 
 * 
 * Todo:
 *  implement sortable that works with current implementation
 */

if (!String.prototype.template) {
	/**
	 * String templates based on Prototype's templating and source based
	 * on Andrew Hedges' pure Simple HTML template Javascript implementation
    * (http://andrew.hedges.name/)
	 *
	 * Usage: "#{greetings}, my name is #{name}".template({greetings:'Hello', name:'Bob'});
	 *        "#{1}, my name is #{0}".template('Bob', 'Hello');
	 */
	String.prototype.template = function() {
		var vals = (1 === arguments.length && 'object' === typeof arguments[0] ? arguments[0] : arguments);
		return this.replace(String.templatePattern, function (str, match) {
			return 'string' === typeof vals[match] || 'number' === typeof vals[match] ? vals[match] : str;
		});
	};
	String.templatePattern = /#\{([^{}]*)\}/g;
}


(function($) {

$.widget("ui.multiselect", {
	_init: function() {
		this.element.hide();
		this.busy = false;  // busy state
		this.container = $('<div class="ui-multiselect ui-helper-clearfix ui-widget"></div>').insertAfter(this.element);
		this.selectedContainer = $('<div class="ui-widget-content list-container selected"></div>').appendTo(this.container);
		this.availableContainer = $('<div class="ui-widget-content list-container available"></div>').appendTo(this.container);
		this.selectedActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="count">'+$.ui.multiselect.locale.itemsCount.template(0)+'</span><a href="#" class="remove-all">'+$.ui.multiselect.locale.removeAll.template()+'</a></div>').appendTo(this.selectedContainer);
		this.availableActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="busy">'+$.ui.multiselect.locale.busy.template()+'</span><input type="text" class="search ui-widget-content ui-corner-all"/><a href="#" class="add-all">'+$.ui.multiselect.locale.addAll.template()+'</a></div>').appendTo(this.availableContainer);
		this.selectedList = $('<ul class="list selected"><li class="ui-helper-hidden-accessible"></li></ul>').bind('selectstart', function(){return false;}).appendTo(this.selectedContainer);
		this.availableList = $('<ul class="list available"><li class="ui-helper-hidden-accessible"></li></ul>').bind('selectstart', function(){return false;}).appendTo(this.availableContainer);
		
		var that = this;

		// initialize data cache
		this.availableList.data('multiselect.cache', {});
		this.selectedList.data('multiselect.cache', {});
		
		if ( !this.options.animated ) {
			this.options.show = 'show';
			this.options.hide = 'hide';
		}

		// sortable / droppable	/ draggable
		var dragOptions = {
			selected: {
				sortable: ('both' == this.options.sortable || 'left' == this.options.sortable),
				droppable: ('both' == this.options.droppable || 'left' == this.options.droppable)
			},
			available: {
				sortable: ('both' == this.options.sortable || 'right' == this.options.sortable),
				droppable: ('both' == this.options.droppable || 'left' == this.options.droppable)
			}
		};
		this._prepareLists('selected', 'available', dragOptions);
		this._prepareLists('available', 'selected', dragOptions);
		
		// set up livesearch
		if (this.options.searchable) {
			this._registerSearchEvents(this.availableContainer.find('input.search'));
		} else {
			this.availableContainer.find('input.search').hide();
		}
		// make sure that we're not busy yet
		this._setBusy(false);
		
		// batch actions
		this.container.find(".remove-all").bind('click.multiselect', function() { that.selectNone(); return false; });
		this.container.find(".add-all").bind('click.multiselect', function() { that.selectAll(); return false; });

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

	/**************************************
    *  Public
    **************************************/

	destroy: function() {
		this.container.remove();
		this.element.show();

		$.widget.prototype.destroy.apply(this, arguments);
	},
	isBusy: function() {
		return this.busy;
	},
	// get all selected values in an array
	selectedValues: function() {
		var values = this.selectedList.children('li.ui-element:visible').map(function(i,item) {
			return $(item).data('multiselect.optionLink').val();
		});
		return Array.prototype.slice.apply(values);
	},
	// get/set enable state
	enabled: function(state) {
		if (undefined !== state) {
			if (state) {
				this.container.unblock();
				this.element.removeAttr('disabled');
			} else {
				this.container.block({message:null,overlayCSS:{backgroundColor:'#fff',opacity:0.3,cursor:'default'}});
				this.element.attr('disabled', true);
			}
		}
		return !this.element.attr('disabled');
	},
	selectAll: function() {
		if (this.enabled()) {
			this._batchSelect(this.availableList.children('li.ui-element:visible'), true);
		}
	},
	selectNone: function() {
		if (this.enabled()) {
			this._batchSelect(this.selectedList.children('li.ui-element:visible'), false);
		}
	},
	select: function(item) {
		if (this.enabled()) {
			var available = this._findItem(item, this.availableList);
			if ( available ) {
				this._setSelected(available, true);
			}
		}
	},
	deselect: function(item) {
		if (this.enabled()) {
			var selected = this._findItem(item, this.selectedList);
			if ( selected ) {
				this._setSelected(selected, false);
			}
		}
	},
	search: function(query) {
		if (this.enabled()) {
			this.availableActions.children('input.search').val(query).trigger('keydown.multiselect');
		}
	},
	// insert new <option> and _populate
	// @return int   the number of options added
	addOptions: function(data) {
		if (this.enabled()) {
			var wasBusy = this.busy;
			this._setBusy(true);

			// format data
			if (data = this.options.formatData(data)) {
				var option, elements = [];
				for (var key in data) {
					// check if the option does not exist already
					if (this.element.find('option[value="'+key+'"]').size()==0) {
						elements.push( $('<option value="'+key+'"/>').text(data[key].value).appendTo(this.element)[0] );
					}
				}
			}

			if (elements.length>0) {
				this._populateLists($(elements));
			}

			this._setBusy(wasBusy);
			return elements.length;
		} else {
			return false;
		}
	},

	/**************************************
    *  Private
    **************************************/

	_prepareLists: function(side, otherSide, opts) {
		var that = this;
		var itemSelected = ('selected' == side);
		var list = this[side+'List'];
		var otherList = this[otherSide+'List'];
		var listDragHelper = opts[otherSide].sortable ? _dragHelper : 'clone';

		list
			.data('multiselect.sortable', opts[side].sortable )
			.data('multiselect.droppable', opts[side].droppable )
			.data('multiselect.draggable', !opts[side].sortable && (opts[otherSide].sortable || opts[otherSide].droppable) );
		
		if (opts[side].sortable) {
			list.sortable({
				appendTo: this.container,
				connectWith: otherList,
				containment: this.container,
				helper: listDragHelper,
				items: 'li.ui-element',
				revert: true,
				beforeStop: function(event, ui) {
					var optionLink = ui.helper.data('multiselect.optionLink');
					$('#debug').text('stopped ' + (ui.item.parent() == list) );
					// if optionLink is defined, then we've received a draggable
					if (optionLink) {
						// if an item already exists
						if (list.data('multiselect.cache')[optionLink.val()]) {
							ui.item.remove();
						} else {
							// prepare item...
							ui.item.hide().data('multiselect.optionLink', optionLink);
							// cache item
							list.data('multiselect.cache')[optionLink.val()] = ui.item;
							that._applyItemState(ui.item, itemSelected);
						}

						// find counter-part item
						if (otherList.data('multiselect.cache')[optionLink.val()]) {
							that._setSelected(that.availableList.data('multiselect.cache')[optionLink.val()], itemSelected);
						}
					}
				}
			});
		} else if (opts[side].sortable) {
			list.droppable({
				accept: '.ui-multiselect ul.' + otherSide + ' li.ui-element',
				hoverClass: 'ui-state-highlight',
				drop: function(event, ui) {
					that._setSelected(ui.draggable, itemSelected);
				}
			});
		}
	},
	_populateLists: function(options) {
		this._setBusy(true);
	
		var that = this;
		// do this async so the browser actually display the waiting message
		setTimeout(function() {
			$(options.each(function(i) {
				var list = (this.selected ? that.selectedList : that.availableList);
		      var item = that._getOptionNode(this).show();
				that._applyItemState(item, this.selected);
				item.data('multiselect.idx', i);

				// cache
				list.data('multiselect.cache')[item.data('multiselect.optionLink').val()] = item;

				that._insertToList(item, list);
		    }));
		
			// update count
			that._setBusy(false);
			that._updateCount();
		}, 1);
	},
	_insertToList: function(node, list) {
		var that = this;
		this._setBusy(true);
		// the browsers don't like batch node insertion...
		var _addNodeRetry = 0;
		var _addNode = function() {
			var succ = (that.options.nodeComparator ? that._getSuccessorNode(node, list) : null);
			try {
				if (succ) {
					node.insertBefore(succ);
				} else {
					list.append(node);
				}
				// callback after node insertion
				that.options.nodeInserted(node);
				that._setBusy(false);
			} catch (e) {
				// if this problem did not occur too many times already
				if ( _addNodeRetry++ < 10 ) {
					// try again later (let the browser cool down first)
					setTimeout(function() { _addNode(); }, 1);
				} else {
					alert($.ui.multiselect.locale.errorInsertNode.template(node.data('multiselect.optionLink').val(), node.text()));
					that._setBusy(false);
				}
			}
		};
		_addNode();
	},
	_updateCount: function() {
		var that = this;
		// defer until system is not busy
		if (this.busy) setTimeout(function() { that._updateCount(); }, 100);
		// count only visible <li> (less .ui-helper-hidden*)
		var count = this.selectedList.children('li:not(.ui-helper-hidden-accessible):visible').size();
		var total = this.availableList.children('li:not(.ui-helper-hidden-accessible, .shadowed)').size() + count;
		this.selectedContainer.find('span.count')
			.text($.ui.multiselect.locale.itemsCount.template(count))
			.attr('title', $.ui.multiselect.locale.itemsTotal.template(total));
	},
	_getOptionNode: function(option) {
		option = $(option);
		var node = $('<li class="ui-state-default ui-element"><span class="ui-icon"/>'+option.text()+'<a href="#" class="ui-state-default action"><span class="ui-corner-all ui-icon"/></a></li>').hide();
		node.data('multiselect.optionLink', option);
		return node;
	},
	// used by select and deselect
	// TODO should the items be matched by their text (visible content) or key value?
	_findItem: function(item, list) {
		var found = null;
		if (parseInt(item) == item) {
			found = list.children('li.ui-element:visible:eq('+item+')');
		} else {
			list.children('li.ui-element:visible').each(function(i,el) {
				el = $(el);
				if (el.data('multiselect.optionLink').val().toLowerCase() === item.toLowerCase()) {
					found = el;
				}
			});
		}
		if ( (null !== found) && (1 === found.size()) ) {
			return found;
		} else {
			return false;
		}
	},
	// clones an item with 
	// didn't find a smarter away around this (michael)
	// now using cache to speed up the process (yr)
	_cloneWithData: function(clonee, cacheName, insertItem) {
		var that = this;
		var id = clonee.data('multiselect.optionLink').val();
		var selected = ('selected' == cacheName);
		var list = (selected ? this.selectedList : this.availableList);
		var clone = list.data('multiselect.cache')[id];

		if (!clone) {
			clone = clonee.clone().hide();
			this._applyItemState(clone, selected);
			// update cache
			list.data('multiselect.cache')[id] = clone;
			// update <option> and idx
			clone.data('multiselect.optionLink', clonee.data('multiselect.optionLink'));
			// need this here because idx is needed in _getSuccessorNode
			clone.data('multiselect.idx', clonee.data('multiselect.idx'));

			// insert the node into it's list
			if (insertItem) {
				this._insertToList(clone, list);
			}
		} else {
			// update idx
			clone.data('multiselect.idx', clonee.data('multiselect.idx'));
		}
		return clone;
	},
	_batchSelect: function(elements, state) {
		var wasBusy = this.busy;
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
			if (!state) that._filter(that.availableList.find('li.ui-element'));

			// restore
			$.extend(that.options, _backup);

			that._updateCount();
			that._setBusy(wasBusy);
		}, 10);
	},
	// find the best successor the given item in the specified list
	// TODO implement a faster sorting algorithm (and remove the idx dependancy)
	_getSuccessorNode: function(item, list) {
		// look for successor based on initial option index
		var items = list.find('li.ui-element'), comparator = this.options.nodeComparator;
		var itemsSize = items.size();

		// no successor, list is null
		if (items.size() == 0) return null;

		var succ, i = Math.min(item.data('multiselect.idx'),itemsSize-1), direction = comparator(item, $(items[i]));

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
		item.data('multiselect.idx', i);
	
		return succ;
	},
	_setSelected: function(item, selected) {
		var that = this;
		try {
			// FIXME see if item.data('multiselect.optionLink').removeAttr('selected') fix this issue (when selected == false)
			item.data('multiselect.optionLink').attr('selected', selected);
		} catch (e) {
			/* HACK! ignore IE complaints */
		}	
		var otherItem;		

		if (selected) {
			// retrieve associatd or cloned item
			otherItem = this._cloneWithData(item, 'selected', true).hide();
			otherItem[this.options.show](this.options.animated);
			item.addClass('shadowed')[this.options.hide](this.options.animated, function() { that._updateCount(); });
		} else {
			// retrieve associated or clone the item
			otherItem = this._cloneWithData(item, 'available', true).hide();
			item[this.options.hide](this.options.animated, function() { that._updateCount() });
			otherItem.removeClass('shadowed');
			if (!otherItem.is('.filtered')) otherItem[this.options.show](this.options.animated);
		}

		if (!this.busy) {
			if (this.options.animated) {
				// pulse
				otherItem.fadeTo('fast', 0.3, function() { $(this).fadeTo('fast', 1); });
			}
		}
		
		return otherItem;
	},
	_setBusy: function(state) {
		var input = this.availableActions.children('input.search');
		var busy = this.availableActions.children('.busy');

		this.container.find("a.remove-all, a.add-all")[state ? 'hide' : 'show']();
		if (state && !this.busy) {
			// backup input state
			input.data('multiselect.hadFocus', input.data('multiselect.hasFocus'));
			// webkit needs to blur before hiding or it won't fire focus again in the else block
			input.blur().hide();
			busy.show();
		} else if(!state && this.busy) {
			input.show();
			busy.hide();
			if (input.data('multiselect.hadFocus')) input.focus();
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
	_filter: function(elements) {
		var input = this.availableActions.children('input.search');
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
	},
	_registerHoverEvents: function(elements) {
		elements
			.unbind('mouseover.multiselect').bind('mouseover.multiselect', function() {
				$(this).find('a').andSelf().addClass('ui-state-hover');
			})
			.unbind('mouseout.multiselect').bind('mouseout.multiselect', function() {
				$(this).find('a').andSelf().removeClass('ui-state-hover');
			})
			.find('a').andSelf().removeClass('ui-state-hover')
		;
	},
	_registerAddEvents: function(elements) {
		var that = this;
		elements.unbind('click.multiselect').bind('click.multiselect', function() {
			// ignore if busy...
			if (!this.busy) {
				that._setSelected($(this).parent(), true);
			}
			return false;
		});
		if (this.availableList.data('multiselect.draggable')) {
			// make draggable
			elements.each(function() {
				$(this).parent().draggable({
					connectToSortable: that.selectedList,
					helper: _dragHelper,
					appendTo: that.container,
					containment: that.container,
					revert: 'invalid'
				});
			});
			// refresh the selected list or the draggable will not connect to it first hand
			if (this.selectedList.data('multiselect.sortable')) {
				this.selectedList.sortable('refresh');
			}
		}
	},
	_registerRemoveEvents: function(elements) {
		var that = this;
		elements.unbind('click.multiselect').bind('click.multiselect', function() {
			// ignore if busy...
			if (!this.busy) that._setSelected($(this).parent(), false);
			return false;
		});
		if (this.selectedList.data('multiselect.draggable')) {
			// make draggable
			elements.each(function() {
				$(this).parent().draggable({
					helper: _dragHelper,
					appendTo: that.container,
					containment: that.container,
					revert: 'invalid'
				});
			});
			// refresh the selected list or the draggable will not connect to it first hand
			if (this.availableList.data('multiselect.sortable')) {
				this.availableList.sortable('refresh');
			}
		}
 	},
	_registerSearchEvents: function(input) {
		var that = this;
		var searchUrl = this.options.remoteUrl,
		    delay = Math.max(this.options.searchDelay,1),
		    previousValue = input.val(), timer;
	
		var _searchNow = function(forceUpdate) {
			if (that.busy) return;

			var value = input.val();
			if ((value != previousValue) || (forceUpdate)) {
				that._setBusy(true);

				if (searchUrl) {
					var params = $.extend({}, that.options.remoteParams);
					try {
						$.get(
							searchUrl,
							$.extend(params, {q:escape(value)}),
							function(data) { 
								that.addOptions(data);
								that._filter(that.availableList.children('li.ui-element')); 
								that._setBusy(false); 
							}
						);
					} catch (e) {
						alert(e.message);
						that._setBusy(false); 
					}
				} else {
					that._filter(that.availableList.children('li.ui-element'));
					that._setBusy(false);
				}

				previousValue = value;
			}
		};

		input
		.bind('focus.multiselect', function() {
			$(this).addClass('ui-state-active').data('multiselect.hasFocus', true);
		})
		.bind('blur.multiselect', function() {
			$(this).removeClass('ui-state-active').data('multiselect.hasFocus', false);
		})
		.bind('keydown.multiselect keypress.multiselect', function(e) {
			if (timer) clearTimeout(timer);
			switch (e.which) {
				case 13:   // enter
					_searchNow(true);
					return false;

				default:
					timer = setTimeout(function() { _searchNow(); }, delay);
			}
		});
		// initiate search filter (delayed)
		var _initSearch = function() {
			if (that.busy) {
				setTimeout(function() { _initSearch(); }, 100);
			}
			_searchNow(true);
		};
		_initSearch();
	}
});
// END ui.multiselect


/********************************
 *  Internal functions
 ********************************/

// FIXME : add some extra data to the helper so we know where it comes from
var _dragHelper = function(event, ui) {
	var item = $(event.target);
	var clone = item.clone().width(item.width());
	clone.find('a').remove();
	clone.data('multiselect.optionLink', item.data('multiselect.optionLink'));
	return clone;
};


/********************************
 *  Default callbacks
 ********************************/

var defaultDataFormatter = function(data) {
	if ( typeof data == 'string' ) {
		var pattern = /^(\s\n\r\t)*\+?$/;
		var selected, line, lines = data.split(/\n/);
		data = {};
		for (var i in lines) {
			line = lines[i].split("=");
			// make sure the key is not empty
			if (!pattern.test(line[0])) {
				selected = (line[0].lastIndexOf('+') == line.length - 1);
				if (selected) line[0] = line.substr(0,line.length-1);
				// if no value is specified, default to the key value
				data[line[0]] = {
					selected: false,
					value: line[1] || line[0]
				};
			}
		}
	} else {
		alert($.ui.multiselect.locale.errorDataFormat.template());
		data = false;
	}
	return data;
};


var defaultNodeComparator = function(node1,node2) {
	var text1 = node1.text(),
	    text2 = node2.text();
	return text1 == text2 ? 0 : (text1 < text2 ? -1 : 1);
};


var defaultNodeInserted = function(node) {
	/* nothing */
};

/****************************
 *  Settings
 ****************************/

$.extend($.ui.multiselect, {
	getter: 'selectedValues enabled isBusy',
	defaults: {
		// sortable and droppable
		sortable: 'left',
		droppable: 'none',
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
		formatData: defaultDataFormatter,
		nodeComparator: defaultNodeComparator,
		nodeInserted: defaultNodeInserted
	},
	locale: {
		addAll:'Add all',
		removeAll:'Remove all',
		itemsCount:'#{0} items selected',
		itemsTotal:'#{0} items total',
		busy:'please wait...',
		errorDataFormat:"Cannot add options, unknown data format",
		errorInsertNode:"There was a problem trying to add the item:\n\n\t[#{0}] => #{1}\n\nThe operation was aborted."
	}
});

})(jQuery);
