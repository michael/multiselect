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
 *	 ui.core.js
 *	 ui.draggable.js
 *  ui.droppable.js
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
 *  add public getters/setters ('select', 'deselect', 'enabled', 'selectedValues', etc.)
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
		this.id = this.element.attr("id");
		this.busy = false;  // busy state
		this.container = $('<div class="ui-multiselect ui-helper-clearfix ui-widget"></div>').insertAfter(this.element);
		this.selectedContainer = $('<div class="ui-widget-content list-container selected"></div>').appendTo(this.container);
		this.availableContainer = $('<div class="ui-widget-content list-container available"></div>').appendTo(this.container);
		this.selectedActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="count">0 '+$.ui.multiselect.locale.itemsCount.template()+'</span><a href="#" class="remove-all">'+$.ui.multiselect.locale.removeAll.template()+'</a></div>').appendTo(this.selectedContainer);
		this.availableActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="busy">'+$.ui.multiselect.locale.busy.template()+'</span><input type="text" class="search ui-widget-content ui-corner-all"/><a href="#" class="add-all">'+$.ui.multiselect.locale.addAll.template()+'</a></div>').appendTo(this.availableContainer);
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
		
		// make selection draggable/droppable or sortable if sortable is "manual"
		//if ('manual' == this.options.sortable) {
		// TODO implement this (sortables and draggables/droppables do not match well together with this implementation)
		// this.container.find('ul.availabe').sortable();
		//	this.container.find('ul.selected').sortable();
		//} else {
			this.container.find("ul.available").droppable({
				accept: '.ui-multiselect ul.selected li.ui-element',
				hoverClass: 'ui-state-highlight',
				drop: function(event, ui) {
					that._setSelected(ui.draggable, false);
				}
			});
			this.container.find("ul.selected").droppable({
				accept: '.ui-multiselect ul.available li.ui-element',
				hoverClass: 'ui-state-highlight',
				drop: function(event, ui) {
					that._setSelected(ui.draggable, true);
				}
			});
		//}
		// normalize to a boolean value 'auto' | true == true, 'manual' | false == false
		this.options.sortable = ('auto' == this.options.sortable) || (true == this.options.sortable);
		
		// set up livesearch
		if (this.options.searchable) {
			this._registerSearchEvents(this.availableContainer.find('input.search'));
		} else {
			this.availableContainer.find('input.search').hide();
		}
		// make sure that we're not busy yet
		this._setBusy(false);
		
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
	// insert new <option> and _populate
	// @return int   the number of options added
	_addOptions: function(data) {
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
				item.data('idx', i);

				// cache
				list.data('cache')[item.data('optionLink').val()] = item;

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
			var succ = that.options.sortable ? that._getSuccessorNode(node, list) : null;
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
					alert($.ui.multiselect.locale.errorInsertNode.template(node.data('optionLink').val(), node.text()));
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
		node.data('optionLink', option);
		return node;
	},
	// clones an item with 
	// didn't find a smarter away around this (michael)
	// now using cache to speed up the process (yr)
	_cloneWithData: function(clonee, cacheName) {
		var that = this;
		var id = clonee.data('optionLink').val();
		var selected = ('selected' == cacheName);
		var list = (selected ? this.selectedList : this.availableList);
		var clone = list.data('cache')[id];

		if (!clone) {
			clone = clonee.clone().hide();
			this._applyItemState(clone, selected);
			// update cache
			list.data('cache')[id] = clone;
			// update <option> and idx
			clone.data('optionLink', clonee.data('optionLink'));
			// need this here because idx is needed in _getSuccessorNode
			clone.data('idx', clonee.data('idx'));

			// insert the node into it's list
			this._insertToList(clone, list);
		} else {
			// update idx
			clone.data('idx', clonee.data('idx'));
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
	_getSuccessorNode: function(item, list) {
		// look for successor based on initial option index
		var items = list.find('li.ui-element'), comparator = this.options.nodeComparator;
		var itemsSize = items.size();

		// no successor, list is null
		if (items.size() == 0) return null;

		var succ, i = Math.min(item.data('idx'),itemsSize-1), direction = comparator(item, $(items[i]));

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
		try {
			item.data('optionLink').attr('selected', selected);
		} catch (e) {
			/* HACK! ignore IE complaints */
		}	
		var otherItem;		

		if (selected) {
			// retrieve associatd or cloned item
			otherItem = this._cloneWithData(item, 'selected').hide();
			otherItem[this.options.show](this.options.animated);
			item.addClass('shadowed')[this.options.hide](this.options.animated, function() { that._updateCount(); });
		} else {
			// retrieve associated or clone the item
			otherItem = this._cloneWithData(item, 'available').hide();
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
			input.data('hadFocus', input.data('hasFocus'));
			// webkit needs to blur before hiding or it won't fire focus again in the else block
			input.blur().hide();
			busy.show();
		} else if(!state && this.busy) {
			input.show();
			busy.hide();
			if (input.data('hadFocus')) input.focus();
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
			.bind('mouseover.multiselect', function() {
				$(this).find('a').andSelf().addClass('ui-state-hover');
			})
			.bind('mouseout.multiselect', function() {
				$(this).find('a').andSelf().removeClass('ui-state-hover');
			})
			.find('a').andSelf().removeClass('ui-state-hover')
		;
	},
	_registerAddEvents: function(elements) {
		var that = this;
		elements.bind('click.multiselect', function() {
			// ignore if busy...
			if (!this.busy) {
				that._setSelected($(this).parent(), true);
			}
			return false;
		})
		// make draggable
		.each(function() {
			$(this).parent().draggable({
				//connectToSortable: that.container.find('ul.selected'),
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
								that._addOptions(data);
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
			$(this).addClass('ui-state-active').data('hasFocus', true);
		})
		.bind('blur.multiselect', function() {
			$(this).removeClass('ui-state-active').data('hasFocus', false);
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
		})
		.parents('form').submit(function(){
			return false;
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
		
$.extend($.ui.multiselect, {
	defaults: {
		// sortable
		sortable: 'auto',
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
		formatData: function(data) {
			if ( typeof data == 'string' ) {
				var pattern = /^(\s\n\r\t)*$/;
				var line, lines = data.split(/\n/);
				data = {};
				for (var i in lines) {
					line = lines[i].split("=");
					// make sure the key is not empty
					if (!pattern.test(line[0])) {
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
		},
		nodeComparator: function(node1,node2) {
			var text1 = node1.text(),
			    text2 = node2.text();
			return text1 == text2 ? 0 : (text1 < text2 ? -1 : 1);
		},
		nodeInserted: function(node) {}
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
