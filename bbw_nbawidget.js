
/* NBA Widget for BaselineBums forum
 * Copyright (c) 2025. All rights reserved.
 * 
 * This code is proprietary and may not be copied, distributed, or modified
 * without explicit written permission from the copyright holder.
 * This code is made publicly visible for transparency purposes only.
 * 
 * No permission is granted to use, copy, modify, merge, publish, distribute, 
 * sublicense, and/or sell copies of this software without explicit written 
 * permission from the copyright holder.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
*/

/* NBA Widget Class 
Globally Manages the NBA Widget
*/
class NBAWidget {

	//********************************************************************
	// Data Methods
	//********************************************************************
	constructor(pstrTeamCode, pstrWidgetDiv, pstrStorageNamespace, pblnDebugMode = false) {
		//*** Default Debug Mode
		this.blnDebugMode = pblnDebugMode;

		//*** Set Data Loaded Flag
		this.blnDataLoaded = false;

		//*** Set Child Components
		this.objTeamSchedule = null;
		this.objLeagueStandings = null;

		//*** Set Data Elements
		this.strWidgetDiv = pstrWidgetDiv;
		this.strTeamCode = pstrTeamCode;
		this.dtmSpotlightDate = new Date();
		this.strSeasonYear = NBAWidget.stcCurrentSeason; //*** Initialize to the current as default
		this.strSeasonType = NBAWidget.stcCurrentSeasonType; //*** Initialize to the current as default
		this.strActiveTab = "fullseason";

		//*** Setup Interactive Elements (these are html tags that require event handling)
		this.selectSeasonYear = null;
		this.selectSeasonType = null;
		this.tabSpotlight = null;
		this.tabFullSeason = null;
		this.tabStandings = null;

		//*** Initialize Helper Classes
		this.objAPIManager = new APIManager();
		this.objAPIManager.procSetDebugMode(pblnDebugMode);
		this.objDataManager = new StorageManager(pstrStorageNamespace);
		this.objDataManager.procSetDebugMode(pblnDebugMode);

		//*** Initialize settings dialog
		this.dialogSettings = null;

		//*** Initialize settings values
		this.objPreferences = this.funcLoadPreferences();
		this.procApplyPreferences();
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
		this.objAPIManager.procSetDebugMode(pblnDebugMode);
	}

	//*** Set Test Date
	procSetTestDate(pdtmTestDate) {
		//*** Allows for testing of spotlight dates
		// Example: set "2025-09-30 15:45:00" in your local time 
		// Convert that to a UTC Date
		this.dtmSpotlightDate = new Date(pdtmTestDate.getTime() - pdtmTestDate.getTimezoneOffset() * 60000);
	}

	//*** Load ScheduleData
	async procLoadData() {
		if (this.blnDebugMode) { console.log("NBAWidget: Begin Load Data"); }

		//*** Load and Process the team's schedule
		const objTeamSchedule = new TeamSchedule(this.objAPIManager, this.objDataManager);
		objTeamSchedule.procSetDebugMode(this.blnDebugMode);
		await objTeamSchedule.funcLoadScheduleData(this.strTeamCode, this.strSeasonYear, this.strSeasonType, "ESPN");
		this.objTeamSchedule = objTeamSchedule;

		//*** Load and Process the NBA Standings
		const objLeagueStandings = new LeagueStandings(this.objAPIManager, this.objDataManager);
		objLeagueStandings.procSetDebugMode(this.blnDebugMode);
		await objLeagueStandings.funcLoadStandingsData(this.strSeasonYear, this.strSeasonType, "ESPN");
		this.objLeagueStandings = objLeagueStandings;

		//*** Log and Return
		this.blnDataLoaded = true;
		if (this.blnDebugMode) { console.log("NBAWidget: Finished Load Data"); }
	}

	//*** Clear Session Storage Data (current schedule and standings)
	procClearWidgetSessionStorage() {
		this.objDataManager.procClearSessionStorage()
	}

	//*** Force Full Clear of all local storage (all data & preferences)
	procClearWidgetLocalStorage() {
		this.objDataManager.procClearLocalStorage()
	}

	//********************************************************************
	// Settings Methods
	//********************************************************************
	//*** Load preferences from localStorage
	funcLoadPreferences() {
		if (this.blnDebugMode) { console.log("NBAWidget - Begin user preference load"); }

		//*** Set the Defaults 
		const defaults = this.funcDefaultSettings()

		//*** Try to Load from Cached Memory
		try {
			const objStoredPrefs = this.objDataManager.funcGetJSONFromStorage("local", "user_preferences")
			if (objStoredPrefs) {
				// Merge but filter out null/undefined values from stored
				const merged = { ...defaults };
				for (const key in objStoredPrefs) {
					if (objStoredPrefs[key] != null) {  // != null checks for both null and undefined
						merged[key] = objStoredPrefs[key];
					}
				}
				if (this.blnDebugMode) { console.log("NBAWidget - Loaded user preferences", merged); }
				return merged;
			}
		} catch (error) {
			console.error("NBAWidget - Error loading preferences:", error);
		}

		//*** Default Defaults if nothing was loaded
		if (this.blnDebugMode) { console.log("NBAWidget - No preferences found; returning defaults"); }
		return defaults;
	}

	//*** Save preferences to localStorage
	procSavePreferences(pobjPreferences) {
		if (this.blnDebugMode) { console.log("NBAWidget - Begin user preference save"); }
		try {
			//*** Try to save user preferences to local storage
			this.objPreferences = pobjPreferences;
			this.objDataManager.procSaveJSONToStorage("local", "user_preferences", pobjPreferences);
			if (this.blnDebugMode) {
				console.log("NBAWidget - Preferences saved:", pobjPreferences);
			}
		} catch (error) {
			console.error("NBAWidget - Error saving preferences:", error);
		}
	}

	//*** Apply user preferences that have been loaded to the widget
	procApplyPreferences() {
		if (this.blnDebugMode) { console.log("NBAWidget - Applying preferences:", this.objPreferences); }

		//*** Apply the new default tab immediately
		this.strActiveTab = this.objPreferences.defaultTab;
	}

	//*** Open settings dialog
	procOpenSettings() {
		//*** Dedicated function in case we decide to move how settings are opened later
		this.procOnTabChange("settings")
	}

	//*** Get Default Settings
	funcDefaultSettings() {
		return {
			theme: "default",
			defaultTab: "spotlight",
			upcomingGamesCount: 3,
			recentGamesCount: 5,
			hideSpotlightStanding: false,
			showRecentFirst: false,
			autoLoadWidget: true
		};
	}

	//********************************************************************
	// Render Methods
	//********************************************************************
	//*** For parent widget only, need a site container finder
	procRenderWidgetContainer() {
		//*** Wrapper class to render the widget within the current webpage
		if (this.blnDebugMode) { console.log("NBAWidget: Begin Widget Container Creation"); }

		//*** Initialize Widget Container
		const divNBAWidgetContainer = document.querySelector('#' + this.strWidgetDiv);
		divNBAWidgetContainer.innerHTML = "";

		//*** Set Global Theme
		let strTheme = "";
		if (this.objPreferences.theme.toLowerCase() === "default") {
			// First, check if the HTML element has a data-color-scheme attribute
			const htmlElement = document.documentElement;
			const strForumExplicitScheme = htmlElement.getAttribute('data-color-scheme');
			if (strForumExplicitScheme) {
				strTheme = strForumExplicitScheme
				if (this.blnDebugMode) { console.log("NBAWidget: Use Forum Explicit Theme: ", strTheme) }
			} else {
				const blnPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				strTheme = blnPrefersDark ? 'dark' : 'light';
				if (this.blnDebugMode) { console.log("NBAWidget: Use System Theme: ", strTheme) }
			}
		} else {
			//*** Use an Explict Widget Theme
			strTheme = this.objPreferences.theme
			if (this.blnDebugMode) { console.log("NBAWidget: Use Explicit Theme: ", strTheme) }
		}

		//*** Set Color Scheme
		if (strTheme === "dark") {
			divNBAWidgetContainer.classList.remove("lightPaletteSpurs");
			divNBAWidgetContainer.classList.add("darkPaletteSpurs");
		} else {
			divNBAWidgetContainer.classList.add("lightPaletteSpurs");
			divNBAWidgetContainer.classList.remove("darkPaletteSpurs");
		}
		//*** Render Widget
		divNBAWidgetContainer.appendChild(this.funcRenderComponent());
		if (this.blnDebugMode) { console.log("NBAWidget: Finished Widget Container Creation"); }
	}

	//*** Main Render Function (Modular)
	funcRenderComponent() {
		if (this.blnDebugMode) { console.log("NBAWidget: Begin Component Render"); }
		const divNBAWidget = document.createElement("div");
		divNBAWidget.className = "bbw-nbawidget"

		//*** Build Rendered Component
		divNBAWidget.appendChild(this.funcRenderWidgetHeader());
		if (this.blnDataLoaded) {
			divNBAWidget.appendChild(this.funcRenderSeasonSelectParameters());
			divNBAWidget.appendChild(this.funcRenderTabs());
			divNBAWidget.appendChild(this.funcRenderContent());
		} else {
			divNBAWidget.appendChild(this.funcRenderNoContent());
		}

		//*** Return Rendered Component
		if (this.blnDebugMode) { console.log("NBAWidget: Finished Component Render"); }
		return divNBAWidget;
	}

	//*** Render Header
	funcRenderWidgetHeader() {
		if (this.blnDebugMode) { console.log("NBAWidget: Begin Header Render"); }

		//*** Define Divs
		const divHeaderContainer = document.createElement("div");
		const divTeamLogo = document.createElement("div");
		const imgTeamLogo = document.createElement("img");
		const divWidgetTitle = document.createElement("div");
		const divHeaderButtons = document.createElement("div");
		const divRefreshButton = document.createElement("div");
		const divSettingsButton = document.createElement("div");

		//*** Set Classes
		divHeaderContainer.className = "bbw-nbawidget-header-container"
		divTeamLogo.className = "bbw-nbawidget-header-logo";
		imgTeamLogo.className = "bbw-nbawidget-header-logo-img";
		divWidgetTitle.className = "bbw-nbawidget-header-title"
		divHeaderButtons.className = "bbw-nbawidget-header-buttongroup";
		divRefreshButton.className = "bbw-nbawidget-header-button";
		divSettingsButton.className = "bbw-nbawidget-header-button";

		//*** Build Team Logo
		imgTeamLogo.src = NBAWidget.funcGetTeamLogoURL(this.strTeamCode.toUpperCase());
		divTeamLogo.appendChild(imgTeamLogo);

		//*** Build Header Title
		divWidgetTitle.innerText = "Spurs Season Overview";
		divRefreshButton.innerHTML = NBAWidget.funcRenderRefreshIcon();
		divSettingsButton.innerHTML = NBAWidget.funcRenderSettingsIcon();

		//*** Add click logo event
		divTeamLogo.addEventListener('click', () => {
			window.open('https://www.espn.com/nba/team/_/name/sa/san-antonio-spurs', '_blank', 'noopener,noreferrer');
		});

		//*** Add click settings event
		divRefreshButton.addEventListener('click', () => {
			this.procOnForceRefresh();
		});

		//*** Add click refresh event
		divSettingsButton.addEventListener('click', () => {
			this.procOpenSettings();
		});

		//*** Build Header (logo, title, settings)
		divHeaderButtons.appendChild(divRefreshButton);
		if (this.blnDataLoaded) { divHeaderButtons.appendChild(divSettingsButton); }
		divHeaderContainer.appendChild(divTeamLogo);
		divHeaderContainer.appendChild(divWidgetTitle);
		divHeaderContainer.appendChild(divHeaderButtons);

		//*** Return Header
		if (this.blnDebugMode) { console.log("NBAWidget: Finished Header Render"); }
		return divHeaderContainer;
	}

	//*** Render Parameter - Season Select
	funcRenderSeasonSelectParameters() {
		if (this.blnDebugMode) { console.log("NBAWidget: Begin Season Select Paramaters Render"); }

		//*** Initialize Tags
		const divSeasonSelectGroup = document.createElement("div");
		const selectSeasonYearPicker = document.createElement("select");
		const selectSeasonTypePicker = document.createElement("select");

		//*** Define div tag classes
		divSeasonSelectGroup.className = "bbw-nbawidget-param-seasongroup";
		selectSeasonYearPicker.id = "bbw-nba-param-select-season-year"
		selectSeasonTypePicker.id = "bbw-nba-param-select-season-type"

		//*** Add Season Year Picker & Current Value
		const arrSeasonYearOptions = [
			{ value: "2026", text: "2025-26" },
			{ value: "2025", text: "2024-25" },
			{ value: "2024", text: "2023-24" },
			{ value: "2023", text: "2022-23" },
			{ value: "2022", text: "2021-22" },
			{ value: "2021", text: "2020-21" },
			{ value: "2020", text: "2019-20" },
			{ value: "2019", text: "2018-19" },
			{ value: "2018", text: "2017-18" },
			{ value: "2017", text: "2016-17" },
			{ value: "2016", text: "2015-16" }
		];
		arrSeasonYearOptions.forEach(option => {
			const optionElement = document.createElement("option");
			optionElement.value = option.value;
			optionElement.innerText = option.text;
			selectSeasonYearPicker.appendChild(optionElement);
		});
		selectSeasonYearPicker.value = this.strSeasonYear;

		//*** Add Season Type Picker & Current Value
		const arrSeasonTypeOptions = [
			{ value: "1", text: "Pre-Season" },
			{ value: "2", text: "Regular Season" },
			{ value: "3", text: "Post-Season" }
		];
		arrSeasonTypeOptions.forEach(option => {
			const optionElement = document.createElement("option");
			optionElement.value = option.value;
			optionElement.innerText = option.text;
			selectSeasonTypePicker.appendChild(optionElement);
		});
		selectSeasonTypePicker.value = this.strSeasonType;

		//*** Add Event Listener to Season Year Picker
		this.selectSeasonYear = selectSeasonYearPicker;
		this.selectSeasonYear.addEventListener('change', () => {
			//*** If changing to a non-current season, automatically switch to Regular Season
			if (this.selectSeasonYear.value !== NBAWidget.stcCurrentSeason) {
				this.selectSeasonType.value = "2";
			} else {
				this.selectSeasonType.value = NBAWidget.stcCurrentSeasonType
			}
			this.strSeasonType = this.selectSeasonType.value

			//*** Change Parameter
			this.procOnParameterChange("strSeasonYear", this.selectSeasonYear.value);
		});

		//*** Add Event Listener to Season Type Picker
		this.selectSeasonType = selectSeasonTypePicker;
		this.selectSeasonType.addEventListener('change', () => {
			this.procOnParameterChange("strSeasonType", this.selectSeasonType.value);
		});

		//*** Compile and Return
		divSeasonSelectGroup.appendChild(selectSeasonYearPicker)
		divSeasonSelectGroup.appendChild(selectSeasonTypePicker)

		//*** Return Rendered Component
		if (this.blnDebugMode) { console.log("NBAWidget: Finished Season Select Paramaters Render"); }
		return divSeasonSelectGroup;
	}

	//*** Render Tabs to Display
	funcRenderTabs() {
		if (this.blnDebugMode) { console.log("NBAWidget: Begin Tab Group Render"); }
		const divTabGroup = document.createElement("div");
		divTabGroup.className = 'bbw-nbawidget-tabgroup';

		//*** Create Tab Divs
		const divTabSpotlight = document.createElement("div");
		const divTabFullSeason = document.createElement("div");
		const divTabStandings = document.createElement("div");

		//*** Set Tab default classes (inactive)
		divTabSpotlight.className = "bbw-nbawidget-tab";
		divTabFullSeason.className = "bbw-nbawidget-tab";
		divTabStandings.className = "bbw-nbawidget-tab";
		divTabSpotlight.id = "bbw-nbawidget-tab-spotlight";
		divTabFullSeason.id = "bbw-nbawidget-tab-fullseason";
		divTabStandings.id = "bbw-nbawidget-tab-standings";

		//*** Set Tab Values
		divTabSpotlight.innerText = "Spotlight";
		divTabFullSeason.innerText = "Schedule";
		divTabStandings.innerText = "Standings";

		//*** Set Tab State Styling
		divTabSpotlight.classList.toggle("active", this.strActiveTab === "spotlight");
		divTabFullSeason.classList.toggle("active", this.strActiveTab === "fullseason");
		divTabStandings.classList.toggle("active", this.strActiveTab === "standings");

		//*** Set Events
		this.tabSpotlight = divTabSpotlight;
		this.tabFullSeason = divTabFullSeason;
		this.tabStandings = divTabStandings;
		this.tabSpotlight.addEventListener('click', () => {
			this.procOnTabChange("spotlight");
		});
		this.tabFullSeason.addEventListener('click', () => {
			this.procOnTabChange("fullseason");
		});
		this.tabStandings.addEventListener('click', () => {
			this.procOnTabChange("standings");
		});

		//*** Build Rendered Tab
		divTabGroup.appendChild(divTabSpotlight);
		divTabGroup.appendChild(divTabFullSeason);
		divTabGroup.appendChild(divTabStandings);

		//*** Return Rendered Tabs
		if (this.blnDebugMode) { console.log("NBAWidget: Finished Tab Group Render"); }
		return divTabGroup;
	}

	//*** Render Content
	funcRenderContent() {
		switch (this.strActiveTab) {
			case "spotlight":
				//*** Setup container tag
				const divSpotlight = document.createElement("div");
				divSpotlight.className = 'bbw-nbawidget-spotlight-container'

				//*** Render Standing with Team Spotlighted (if standings exist)
				if (!this.objPreferences.hideSpotlightStanding) {
					const divSpotlightStanding = document.createElement("div");
					divSpotlightStanding.className = "bbw-nbawidget-spotlight-standing";
					const objTeamStanding = this.objLeagueStandings.funcGetTeamStanding(this.strTeamCode);
					if (objTeamStanding) {
						divSpotlightStanding.appendChild(objTeamStanding.funcRenderComponent());
						divSpotlight.appendChild(divSpotlightStanding);
					}
				}

				//*** Render Team Schedule with Spotlight Date and user preferences
				divSpotlight.appendChild(this.objTeamSchedule.funcRenderSpotlight(
					this.dtmSpotlightDate,
					this.objPreferences.upcomingGamesCount || 3,
					this.objPreferences.recentGamesCount || 3,
					this.objPreferences.showRecentFirst || false
				));

				//*** Return spotlight container
				return divSpotlight;

			case "fullseason":
				//*** Render Team's full season
				return this.objTeamSchedule.funcRenderSeasonSchedule();

			case "standings":
				//*** Render full league standings
				return this.objLeagueStandings.funcRenderComponent();

			case "settings":
				return this.funcRenderSettingsTab();
		}
	}

	//*** Render settings tab
	funcRenderSettingsTab() {
		//*** Helper to create a settings row
		const createSettingRow = (labelText, valueElement) => {
			const row = document.createElement("div");
			const label = document.createElement("label");
			const separator = document.createElement("div");
			row.className = "bbw-nbawidget-settings-row";
			label.className = "bbw-nbawidget-settings-label";
			separator.className = "bbw-nbawidget-settings-separator";
			label.innerText = labelText;
			separator.innerText = ":";
			row.appendChild(label);
			row.appendChild(separator);
			row.appendChild(valueElement);
			return row;
		};

		//*** Initialize container tags
		const divSettingContainer = document.createElement("div");
		const divBody = document.createElement("div");
		const divFooter = document.createElement("div");
		const btnSave = document.createElement("button");

		//*** Set classes
		divSettingContainer.className = "bbw-nbawidget-settings-container";
		divBody.className = "bbw-nbawidget-settings-body";
		divFooter.className = "bbw-nbawidget-settings-footer";
		btnSave.className = "bbw-nbawidget-settings-button bbw-nbawidget-settings-button-save";

		//*** Create Default Tab select
		const selectTheme = document.createElement("select");
		selectTheme.className = "bbw-nbawidget-settings-value";
		selectTheme.id = "bbw-settings-theme";
		const arrThemeOptions = [
			{ value: "default", text: "Forum" },
			{ value: "light", text: "Light" },
			{ value: "dark", text: "Dark" }
		];
		arrThemeOptions.forEach(option => {
			const optElement = document.createElement("option");
			optElement.value = option.value;
			optElement.innerText = option.text;
			if (option.value === this.objPreferences.theme) {
				optElement.selected = true;
			}
			selectTheme.appendChild(optElement);
		});

		//*** Create Default Tab select
		const selectDefaultTab = document.createElement("select");
		selectDefaultTab.className = "bbw-nbawidget-settings-value";
		selectDefaultTab.id = "bbw-settings-default-tab";
		const arrTabOptions = [
			{ value: "spotlight", text: "Spotlight" },
			{ value: "fullseason", text: "Schedule" },
			{ value: "standings", text: "Standings" }
		];
		arrTabOptions.forEach(option => {
			const optElement = document.createElement("option");
			optElement.value = option.value;
			optElement.innerText = option.text;
			if (option.value === this.objPreferences.defaultTab) {
				optElement.selected = true;
			}
			selectDefaultTab.appendChild(optElement);
		});

		//*** Create Auto Load toggle switch
		const lblAutoLoad = document.createElement("label");
		const inputAutoLoad = document.createElement("input");
		const spanAutoLoadSlider = document.createElement("span");
		lblAutoLoad.className = "bbw-nbawidget-settings-switch";
		spanAutoLoadSlider.className = "bbw-nbawidget-settings-slider";
		inputAutoLoad.type = "checkbox";
		inputAutoLoad.id = "bbw-settings-auto-load";
		inputAutoLoad.checked = this.objPreferences.autoLoadWidget;
		lblAutoLoad.appendChild(inputAutoLoad);
		lblAutoLoad.appendChild(spanAutoLoadSlider);

		//*** Create Upcoming Games input
		const inputUpcomingGames = document.createElement("input");
		inputUpcomingGames.className = "bbw-nbawidget-settings-value";
		inputUpcomingGames.id = "bbw-settings-upcoming-games";
		inputUpcomingGames.type = "number";
		inputUpcomingGames.min = "1";
		inputUpcomingGames.max = "99";
		inputUpcomingGames.value = this.objPreferences.upcomingGamesCount;

		//*** Create Recent Games input
		const inputRecentGames = document.createElement("input");
		inputRecentGames.className = "bbw-nbawidget-settings-value";
		inputRecentGames.id = "bbw-settings-recent-games";
		inputRecentGames.type = "number";
		inputRecentGames.min = "1";
		inputRecentGames.max = "99";
		inputRecentGames.value = this.objPreferences.recentGamesCount;

		//*** Create Show Recent First toggle switch
		const lblRecentFirst = document.createElement("label");
		const inputRecentFirst = document.createElement("input");
		const spanRecentSlider = document.createElement("span");
		lblRecentFirst.className = "bbw-nbawidget-settings-switch";
		spanRecentSlider.className = "bbw-nbawidget-settings-slider";
		inputRecentFirst.type = "checkbox";
		inputRecentFirst.id = "bbw-settings-recent-first";
		inputRecentFirst.checked = this.objPreferences.showRecentFirst;
		lblRecentFirst.appendChild(inputRecentFirst);
		lblRecentFirst.appendChild(spanRecentSlider);

		//*** Create Hide Spotlight Standing toggle switch
		const lblHideStanding = document.createElement("label");
		const inputHideStanding = document.createElement("input");
		const spanHideStandingSlider = document.createElement("span");
		lblHideStanding.className = "bbw-nbawidget-settings-switch";
		spanHideStandingSlider.className = "bbw-nbawidget-settings-slider";
		inputHideStanding.type = "checkbox";
		inputHideStanding.id = "bbw-settings-hide-standing";
		inputHideStanding.checked = this.objPreferences.hideSpotlightStanding;
		lblHideStanding.appendChild(inputHideStanding);
		lblHideStanding.appendChild(spanHideStandingSlider);

		//*** Create Delete Data on Save
		const lblClearStorage = document.createElement("label");
		const inputClearStorage = document.createElement("input");
		const spanClearStorageSlider = document.createElement("span");
		lblClearStorage.className = "bbw-nbawidget-settings-switch";
		spanClearStorageSlider.className = "bbw-nbawidget-settings-slider";
		inputClearStorage.type = "checkbox";
		inputClearStorage.id = "bbw-settings-clear-storage";
		inputClearStorage.checked = false;
		lblClearStorage.appendChild(inputClearStorage);
		lblClearStorage.appendChild(spanClearStorageSlider);

		//*** Save Button
		btnSave.innerText = "Save";
		btnSave.addEventListener('click', () => {
			//*** Check if Storage Clear has been triggered
			if (!inputClearStorage.checked) {
				//*** Save New Preferences
				const strTheme = selectTheme.value;
				const strNewDefaultTab = selectDefaultTab.value;
				let intUpcomingGames = parseInt(inputUpcomingGames.value);
				let intRecentGames = parseInt(inputRecentGames.value);
				const blnHideStanding = inputHideStanding.checked;
				const blnShowRecentFirst = inputRecentFirst.checked;
				const blnAutoLoad = inputAutoLoad.checked;

				//*** Health Check
				intUpcomingGames = Math.max(1, Math.min(99, intUpcomingGames));
				intRecentGames = Math.max(1, Math.min(99, intRecentGames));

				//*** Save Preferences
				this.procSavePreferences({
					theme: strTheme,
					defaultTab: strNewDefaultTab,
					upcomingGamesCount: intUpcomingGames,
					recentGamesCount: intRecentGames,
					hideSpotlightStanding: blnHideStanding,
					showRecentFirst: blnShowRecentFirst,
					autoLoadWidget: blnAutoLoad
				});

			} else {
				//*** Clear all storage and re-render widget
				this.procClearWidgetSessionStorage();
				this.procClearWidgetLocalStorage();
				this.procSavePreferences(this.funcDefaultSettings());
			}

			//*** Re-Apply New Settings and Render Widget
			this.procApplyPreferences();
			this.procRenderWidgetContainer();
		});

		//*** Assemble body with header and setting rows
		divBody.appendChild(NBAWidget.funcRenderGroupHeader("Widget Settings"));
		divBody.appendChild(createSettingRow("Widget Theme", selectTheme));
		divBody.appendChild(createSettingRow("Default Tab", selectDefaultTab));
		divBody.appendChild(createSettingRow("Auto Load Widget", lblAutoLoad));
		divBody.appendChild(NBAWidget.funcRenderGroupHeader("Spotlight Settings"));
		divBody.appendChild(createSettingRow("# Upcoming Games", inputUpcomingGames));
		divBody.appendChild(createSettingRow("# Recent Games", inputRecentGames));
		divBody.appendChild(createSettingRow("Show Recent First", lblRecentFirst));
		divBody.appendChild(createSettingRow("Hide Spotlight Standing", lblHideStanding));
		divBody.appendChild(NBAWidget.funcRenderGroupHeader("Data Storage"));
		divBody.appendChild(createSettingRow("Reset Widget Data", lblClearStorage));

		//*** Assemble footer
		divFooter.appendChild(btnSave);

		//*** Assemble container
		divSettingContainer.appendChild(divBody);
		divSettingContainer.appendChild(divFooter);

		return divSettingContainer;
	}

	//*** Render Empty Data Refresh Content
	funcRenderNoContent() {
		if (this.blnDebugMode) { console.log("NBAWidget: Begin No Content Render"); }
		const divNoContentContainer = document.createElement("div");
		divNoContentContainer.className = 'bbw-nbawidget-sch-container';

		const divNoData = document.createElement("div");
		divNoData.className = "bbw-nbawidget-nodata";
		divNoData.innerText = "Auto-Load Preference Turned Off.\nClick Refresh to Load Widget.";
		divNoContentContainer.appendChild(divNoData);
		if (this.blnDebugMode) { console.log("NBAWidget: Finished No Content Render"); }
		return divNoContentContainer;
	}

	//*** Render Generic Widget Header
	static funcRenderGroupHeader(pstrGroupTitle, pstrCSSClassName = "bbw-nbawidget-group-header") {
		//*** Render a generic Header 
		const divHeader = document.createElement("div");
		divHeader.className = pstrCSSClassName;
		divHeader.innerText = pstrGroupTitle;
		return divHeader;
	}

	//*** Settings Icon
	static funcRenderSettingsIcon() {
		return `<svg height="100px" width="100px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 489.80 489.80"><path d="M20.701,281.901l32.1,0.2c4.8,24.7,14.3,48.7,28.7,70.5l-22.8,22.6c-8.2,8.1-8.2,21.2-0.2,29.4l24.6,24.9 c8.1,8.2,21.2,8.2,29.4,0.2l22.8-22.6c21.6,14.6,45.5,24.5,70.2,29.5l-0.2,32.1c-0.1,11.5,9.2,20.8,20.7,20.9l35,0.2 c11.5,0.1,20.8-9.2,20.9-20.7l0.2-32.1c24.7-4.8,48.7-14.3,70.5-28.7l22.6,22.8c8.1,8.2,21.2,8.2,29.4,0.2l24.9-24.6 c8.2-8.1,8.2-21.2,0.2-29.4l-22.6-22.8c14.6-21.6,24.5-45.5,29.5-70.2l32.1,0.2c11.5,0.1,20.8-9.2,20.9-20.7l0.2-35 c0.1-11.5-9.2-20.8-20.7-20.9l-32.1-0.2c-4.8-24.7-14.3-48.7-28.7-70.5l22.8-22.6c8.2-8.1,8.2-21.2,0.2-29.4l-24.6-24.9 c-8.1-8.2-21.2-8.2-29.4-0.2l-22.8,22.6c-21.6-14.6-45.5-24.5-70.2-29.5l0.2-32.1c0.1-11.5-9.2-20.8-20.7-20.9l-35-0.2 c-11.5-0.1-20.8,9.2-20.9,20.7l-0.3,32.1c-24.8,4.8-48.8,14.3-70.5,28.7l-22.6-22.8c-8.1-8.2-21.2-8.2-29.4-0.2l-24.8,24.6 c-8.2,8.1-8.2,21.2-0.2,29.4l22.6,22.8c-14.6,21.6-24.5,45.5-29.5,70.2l-32.1-0.2c-11.5-0.1-20.8,9.2-20.9,20.7l-0.2,35 C-0.099,272.401,9.201,281.801,20.701,281.901z M179.301,178.601c36.6-36.2,95.5-35.9,131.7,0.7s35.9,95.5-0.7,131.7 s-95.5,35.9-131.7-0.7S142.701,214.801,179.301,178.601z"></path> </g> </g></svg>
`;
	}

	//*** Refresh Icon
	static funcRenderRefreshIcon() {
		return `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118.04 122.88"><path d="M16.08,59.26A8,8,0,0,1,0,59.26a59,59,0,0,1,97.13-45V8a8,8,0,1,1,16.08,0V33.35a8,8,0,0,1-8,8L80.82,43.62a8,8,0,1,1-1.44-15.95l8-.73A43,43,0,0,0,16.08,59.26Zm22.77,19.6a8,8,0,0,1,1.44,16l-10.08.91A42.95,42.95,0,0,0,102,63.86a8,8,0,0,1,16.08,0A59,59,0,0,1,22.3,110v4.18a8,8,0,0,1-16.08,0V89.14h0a8,8,0,0,1,7.29-8l25.31-2.3Z"/></svg>`
	}

	//********************************************************************
	// Events Methods
	//********************************************************************
	//*** Function to Handle Forced Refreshes
	procOnForceRefresh() {
		if (this.blnDebugMode) { console.log("NBAWidget: Begin Widget Refresh"); }

		//*** Clear the session cache
		this.procClearWidgetSessionStorage();

		//*** Reload data and re-render
		(async () => {
			await this.procLoadData();
			this.procRenderWidgetContainer();
			if (this.blnDebugMode) { console.log("NBAWidget: Finished Widget Refresh"); }
		})();
	}

	//*** Function to Handle a parameter change
	procOnParameterChange(strObjectPropertyName, objNewValue) {
		if (this.blnDebugMode) { console.log(`NBAWidget: Begin ${strObjectPropertyName} Parameter Changed: ${objNewValue}`); }

		//*** Set new parameter property and re-process the widget
		this[strObjectPropertyName] = objNewValue;

		(async () => {
			await this.procLoadData();
			this.procRenderWidgetContainer();
			if (this.blnDebugMode) { console.log(`NBAWidget: Finished ${strObjectPropertyName} Parameter Changed: ${objNewValue}`); }
		})();
	}

	//*** Function to Handle a tab change
	procOnTabChange(pstrSelectedTab) {
		if (this.blnDebugMode) { console.log("NBAWidget: Tab Changed: " + pstrSelectedTab); }

		//*** Set Active tab
		this.strActiveTab = pstrSelectedTab;

		//*** Re-Render Widget
		this.procRenderWidgetContainer();
	}

	//********************************************************************
	// Helper Methods & Properties
	//********************************************************************
	static stcCurrentSeason = "2026";
	static stcCurrentSeasonType = "1";

	//*** Check if 2 dates are the same 
	static funcIsSameDate(pdtmDate1, pdtmDate2) {
		return pdtmDate1.getFullYear() === pdtmDate2.getFullYear() &&
			pdtmDate1.getMonth() === pdtmDate2.getMonth() &&
			pdtmDate1.getDate() === pdtmDate2.getDate();
	}

	//*** Get team logo URL
	static funcGetTeamLogoURL(pstrTeamAbbr) {
		//*** Use the same mapping from Game class
		const strTeamId = NBAWidget.mapNBAdotComTeamIDs[pstrTeamAbbr];
		if (strTeamId) {
			return `https://cdn.nba.com/logos/nba/${strTeamId}/primary/L/logo.svg`;
		}
		return "https://cdn.nba.com/logos/nba/logo.svg";
	}

	//*** NBA Team Name Replacement Mappings
	static mapShortenTeamNames = {
		"Timberwolves": "Wolves",
		"Trail Blazers": "Blazers",
		"Trailblazers": "Blazers"
	}

	//*** NBA Team Logo Mappings
	static mapNBAdotComTeamIDs = {
		// Eastern Conference
		"ATL": 1610612737, // Atlanta Hawks
		"BOS": 1610612738, // Boston Celtics  
		"BKN": 1610612751, // Brooklyn Nets
		"CHA": 1610612766, // Charlotte Hornets
		"CHI": 1610612741, // Chicago Bulls
		"CLE": 1610612739, // Cleveland Cavaliers
		"DET": 1610612765, // Detroit Pistons
		"IND": 1610612754, // Indiana Pacers
		"MIA": 1610612748, // Miami Heat
		"MIL": 1610612749, // Milwaukee Bucks
		"NY": 1610612752,  // New York Knicks
		"NYK": 1610612752, // New York Knicks (alternate)
		"ORL": 1610612753, // Orlando Magic
		"PHI": 1610612755, // Philadelphia 76ers
		"TOR": 1610612761, // Toronto Raptors
		"WAS": 1610612764, // Washington Wizards
		"WSH": 1610612764, // Washington Wizards (alternate)

		// Western Conference
		"DAL": 1610612742, // Dallas Mavericks
		"DEN": 1610612743, // Denver Nuggets
		"GS": 1610612744,  // Golden State Warriors
		"GSW": 1610612744, // Golden State Warriors (alternate)
		"HOU": 1610612745, // Houston Rockets
		"LAC": 1610612746, // Los Angeles Clippers
		"LAL": 1610612747, // Los Angeles Lakers
		"MEM": 1610612763, // Memphis Grizzlies
		"MIN": 1610612750, // Minnesota Timberwolves
		"NO": 1610612740,  // New Orleans Pelicans
		"NOP": 1610612740, // New Orleans Pelicans (alternate)
		"OKC": 1610612760, // Oklahoma City Thunder
		"PHX": 1610612756, // Phoenix Suns
		"POR": 1610612757, // Portland Trail Blazers
		"SAC": 1610612758, // Sacramento Kings
		"SA": 1610612759,  // San Antonio Spurs
		"SAS": 1610612759, // San Antonio Spurs (alternate)
		"UTA": 1610612762,  // Utah Jazz
		"UTAH": 1610612762  // Utah Jazz (alternate)
	};

}

/* Team Schedule Class 
Manages the Parsing of Schedule Data
*/
class TeamSchedule {
	//********************************************************************
	// Data Methods
	//********************************************************************
	constructor(pobjApiManager, pobjDataManager) {
		//*** Store reference to API manager
		this.objApiManager = pobjApiManager;
		this.objDataManager = pobjDataManager;

		//*** Initialize properties with defaults
		this.strTeamCode = "";
		this.strSeason = "";
		this.strSeasonType = "";
		this.strApiSource = "";

		//*** Initialize data storage properties
		this.arrGameObjects = null;

		//*** Default Debug Mode is False
		this.blnDebugMode = false;
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
	}

	// Load Schedule Data from API - Stores JSON only
	async funcLoadScheduleData(pstrTeamCode, pstrSeason, pstrSeasonType, pstrApiSource, pblnForceRefresh = false) {
		//*** Log request
		if (this.blnDebugMode) {
			console.log(`TeamSchedule - Loading data for ${pstrTeamCode}, Season: ${pstrSeason}, Type: ${pstrSeasonType}, Source: ${pstrApiSource}, ForceRefresh: ${pblnForceRefresh}`);
		}

		//*** Store current request parameters
		this.strTeamCode = pstrTeamCode;
		this.strSeason = pstrSeason;
		this.strSeasonType = pstrSeasonType;
		this.strApiSource = pstrApiSource;

		//*** Clear any existing parsed games (new data loading)
		this.arrGameObjects = null;

		//*** If prior seasons, store in local storage.  If current, in session storage (gets cleared per widget load and refreshes)
		let strStorageType = "";
		if (parseInt(pstrSeason) < NBAWidget.stcCurrentSeason) { strStorageType = "local"; } else { strStorageType = "session"; }

		//*** Check if JSON data has been stored in storage
		const strStorageKey = `schedule_${pstrTeamCode}_${pstrSeason}_${pstrSeasonType}`;
		let jsonScheduleData = this.objDataManager.funcGetJSONFromStorage(strStorageType, strStorageKey);
		if (!jsonScheduleData) {
			switch (pstrApiSource.toLowerCase()) {
				case "espn":
					jsonScheduleData = await this.funcGetScheduleDataESPN(pstrTeamCode, pstrSeason, pstrSeasonType);
					break;
				default:
					console.error(`TeamSchedule - Unknown API source: ${pstrApiSource}`);
					return null;
			}
		}

		//*** Handle Results and Data Management
		if (jsonScheduleData) {
			//*** Store Parsed Result in memory
			this.objDataManager.procSaveJSONToStorage(strStorageType, strStorageKey, jsonScheduleData);
			if (this.blnDebugMode) { console.log("TeamSchedule - Data loaded successfully"); }
		} else {
			//*** Ensure Nothing was saved in memory
			this.objDataManager.procRemoveDataFromStorage(strStorageType, strStorageKey);
			if (this.blnDebugMode) { console.log("TeamSchedule - Data load failed"); }
			return;
		}

		//*** Parse JSON File
		this.arrGameObjects = this.funcParseJSONESPN(jsonScheduleData);
	}

	// Get JSON Data from ESPN
	async funcGetScheduleDataESPN(pstrTeamCode, pstrSeason, pstrSeasonType) {
		//*** Build API Url
		const strUrl = `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${pstrTeamCode}/schedule?region=us&lang=en&season=${pstrSeason}&seasontype=${pstrSeasonType}`;

		//*** Fetch data using API manager
		if (this.blnDebugMode) { console.log(`TeamSchedule - Begin Fetch ESPN Data: ${strUrl}`); }
		const jsonRawJSON = await this.objApiManager.funcGetAPIData(strUrl, "json");

		//*** Return Results
		if (this.blnDebugMode) { console.log(`TeamSchedule - Finish Fetch ESPN Data: ${strUrl}`); }
		return jsonRawJSON;
	}

	// Parse ESPN JSON into Game objects
	funcParseJSONESPN(pobjJSONScheduleData) {
		//*** Log step
		if (this.blnDebugMode) {
			console.log("TeamSchedule - Parsing ESPN JSON data");
		}

		//*** Short circuit if JSON isn't in the proper format
		if (!pobjJSONScheduleData || !pobjJSONScheduleData.events) {
			console.error("TeamSchedule - ESPN JSON data is invalid or missing events");
			return [];
		}

		//*** Loop through each event record and create game objects
		const arrGamesArray = [];
		for (const objEvent of pobjJSONScheduleData.events) {
			//*** Get Game Date from event object
			const dtmGameDate = new Date(objEvent.date);

			//*** Competition Record to get team details
			const objCompetition = objEvent.competitions[0];
			if (!objCompetition) continue;

			//*** Extract the Team details (find our team and opponent)
			const objOurTeam = objCompetition.competitors.find(objCompetitor => objCompetitor.team.abbreviation === this.strTeamCode.toUpperCase());
			const objOppTeam = objCompetition.competitors.find(objCompetitor => objCompetitor !== objOurTeam);

			//*** Build a new game object for rendering
			if (this.blnDebugMode) {
				console.log(`TeamSchedule - Adding game vs ${objOppTeam?.team?.abbreviation} on ${dtmGameDate.toLocaleDateString("en-US")}`);
			}
			const objGame = new Game(
				dtmGameDate || "Date Unknown",
				objCompetition?.status?.type?.description ?? "Status Unknown",
				objOurTeam?.team?.shortDisplayName ?? this.strTeamCode,
				objOurTeam?.score?.displayValue ?? "0",
				objOurTeam?.score?.displayValue != null,
				objOurTeam?.winner != null,
				objOurTeam?.winner ?? false,
				objOurTeam?.homeAway ? objOurTeam.homeAway === "home" : true,
				objOppTeam?.team?.abbreviation ?? "Unknown",
				objOppTeam?.team?.shortDisplayName ?? "Unknown",
				objOppTeam?.score?.displayValue ?? "0"
			);

			//*** Add additional stats if they're found
			this.procMapESPNGameStat(objEvent, objGame.objDetailCatalog)

			//*** Push to array of games
			objGame.procSetDebugMode(this.blnDebugMode);
			arrGamesArray.push(objGame);
		}

		//*** Filter out any nulls
		const arrFilteredGames = arrGamesArray.filter(objGame => objGame != null);

		//*** Log completion
		if (this.blnDebugMode) {
			console.log(`TeamSchedule - ESPN parsing complete. ${arrFilteredGames.length} games parsed`);
		}

		//*** Return the filtered array
		return arrFilteredGames;
	}

	//*** Helper function to find and create Detail objects from ESPN stats
	procMapESPNGameStat(pobjEvent, pobjDetailCatalog) {
		//*** Get the competition object (first one)
		const objCompetition = pobjEvent.competitions?.[0];
		if (!objCompetition) return;

		//*** Find our team 
		const objOurTeam = objCompetition.competitors?.find(comp => comp.team?.abbreviation?.toLowerCase() === this.strTeamCode.toLowerCase());

		//***********************
		// Game Information
		//***********************
		//*** Venue Town State
		if (objCompetition.venue?.address?.city) {
			let strLocation = objCompetition.venue.address.city;
			if (objCompetition.venue?.address?.state) {
				strLocation += `, ${objCompetition.venue.address.state}`;
			}

			pobjDetailCatalog.procAddDetailByValues(
				"Game Info", "location", "text", "location", "Location",
				strLocation, strLocation
			);
		}

		//***  Venue Name
		//if (objCompetition.venue?.fullName) {
		//	pobjDetailCatalog.procAddDetailByValues(
		//		"Game Info", "venue", "text", "", "Venue", 
		//		objCompetition.venue.fullName, objCompetition.venue.fullName
		//	);
		//}

		//*** Attendance
		if (objCompetition.attendance) {
			pobjDetailCatalog.procAddDetailByValues(
				"Game Info", "attendance", "quantity", "attendance", "Attendance",
				objCompetition.attendance, objCompetition.attendance.toLocaleString()
			);
		}

		//***********************
		// Team Records
		//***********************
		//*** Year to Date Record
		if (objOurTeam?.record) {
			const objYTDRecord = objOurTeam.record.find(record => record.shortDisplayName?.toLowerCase() === "ytd");
			if (objYTDRecord?.displayValue) {
				pobjDetailCatalog.procAddDetailByValues(
					"Team Records", "ytd", "text", "ytd", "Season Record", objYTDRecord.displayValue, objYTDRecord.displayValue
				);
			}
		}

		//*** Player Leaders
		if (objOurTeam?.leaders) {
			objOurTeam.leaders.forEach(leader => {
				if (leader.leaders?.[0]?.athlete?.displayName && leader.leaders[0]?.displayValue) {
					const strLeaderName = leader.leaders[0].athlete.shortName;
					const strLeaderValue = leader.leaders[0].displayValue;
					const strDisplayText = `${strLeaderName} (${strLeaderValue})`;

					pobjDetailCatalog.procAddDetailByValues(
						"Team Records",
						leader.name?.toLowerCase() || "unknown",
						"text",
						leader.name?.toLowerCase() || "unknown",
						leader.displayName || leader.name || "Unknown Stat",
						strDisplayText,
						strDisplayText
					);
				}
			});
		}

		//***********************
		// Links
		//***********************
		if (pobjEvent.links) {
			//*** Find Gamecast link
			const objGamecastLink = pobjEvent.links.find(link => link.text?.toLowerCase() === "gamecast" && link.href?.startsWith("http"));
			if (objGamecastLink?.href) {
				pobjDetailCatalog.procAddDetailByValues(
					"ESPN Links", "gamecast", "link", "", "Gamecast",
					objGamecastLink.href, "View Gamecast"
				);
			}

			//*** Find Box Score link
			const objBoxscoreLink = pobjEvent.links.find(link => link.text?.toLowerCase() === "box score" && link.href?.startsWith("http"));
			if (objBoxscoreLink?.href) {
				pobjDetailCatalog.procAddDetailByValues(
					"ESPN Links", "boxscore", "link", "", "Box Score",
					objBoxscoreLink.href, "Full Box Score"
				);
			}
		}
	}

	//********************************************************************
	// Render Methods
	//********************************************************************

	// Render Spotlight Schedule: Today's Game, Last X Games, Next X Games
	funcRenderSpotlight(pdtmSpotlightDate, pintUpcomingGames, pintRecentGames, pblnShowRecentFirst) {
		if (this.blnDebugMode) { console.log("Team Schedule: Begin Render Spotlight Tab:" + pdtmSpotlightDate.toLocaleString()) }
		const divSpotlightGames = document.createElement("div");
		divSpotlightGames.className = 'bbw-nbawidget-sch-container'

		//*** Declare Variables
		const intPastGames = pintRecentGames;
		const intUpcomingGames = pintUpcomingGames;
		const arrPastGames = [];
		const arrUpcomingGames = [];
		let objTodaysGame = null;
		let blnHasSpotlightContent = false;

		//*** Split games into three categories
		for (const objGame of this.arrGameObjects) {
			//*** Determine what group current game belongs to
			const dtmGameDate = objGame.dtmGameDate;
			if (NBAWidget.funcIsSameDate(dtmGameDate, pdtmSpotlightDate)) {
				objTodaysGame = objGame;
			} else if (dtmGameDate < pdtmSpotlightDate) {
				arrPastGames.push(objGame);
			} else {
				arrUpcomingGames.push(objGame);
			}

			//*** Short circuit if upcoming games is full (assume sorted array)
			if (arrUpcomingGames.length >= intUpcomingGames) { break; }
		}

		//*** Build Today's section
		let divTodaySection = null;
		if (objTodaysGame) {
			blnHasSpotlightContent = true;
			divTodaySection = document.createDocumentFragment();
			divTodaySection.appendChild(NBAWidget.funcRenderGroupHeader("Today's Game"));
			divTodaySection.appendChild(objTodaysGame.funcRenderComponent(true));
		}

		//*** Build Upcoming section
		let divUpcomingSection = null;
		if (arrUpcomingGames.length > 0) {
			blnHasSpotlightContent = true;
			divUpcomingSection = document.createDocumentFragment();
			divUpcomingSection.appendChild(NBAWidget.funcRenderGroupHeader("Upcoming Games"));
			for (const objGame of arrUpcomingGames) {
				divUpcomingSection.appendChild(objGame.funcRenderComponent(true));
			}
		}

		//*** Build Recent section
		let divRecentSection = null;
		if (arrPastGames.length > 0) {
			blnHasSpotlightContent = true;
			divRecentSection = document.createDocumentFragment();
			divRecentSection.appendChild(NBAWidget.funcRenderGroupHeader("Recent Results"));
			for (const objGame of arrPastGames.slice(-intPastGames).reverse()) {
				divRecentSection.appendChild(objGame.funcRenderComponent(true));
			}
		}

		//*** Check if we have schedule data
		if (!blnHasSpotlightContent) {
			const divNoData = document.createElement("div");
			divNoData.className = "bbw-nbawidget-nodata";
			divNoData.innerText = "No games to spotlight";
			divSpotlightGames.appendChild(divNoData);
			if (this.blnDebugMode) { console.log("TeamSchedule: No spotlight data available"); }
			return divSpotlightGames;
		}

		//*** Append Sections if they exist
		if (divTodaySection) { divSpotlightGames.appendChild(divTodaySection); }
		if (pblnShowRecentFirst) {
			if (divRecentSection) { divSpotlightGames.appendChild(divRecentSection); }
			if (divUpcomingSection) { divSpotlightGames.appendChild(divUpcomingSection); }
		} else {
			if (divUpcomingSection) { divSpotlightGames.appendChild(divUpcomingSection); }
			if (divRecentSection) { divSpotlightGames.appendChild(divRecentSection); }
		}

		//*** Return Rendered Component
		if (this.blnDebugMode) { console.log("Team Schedule: Finished Render Spotlight Tab:" + pdtmSpotlightDate.toLocaleString()) }
		return divSpotlightGames;
	}

	// Render Full Season Schedule Chronologically by Month+Year
	funcRenderSeasonSchedule() {
		//*** Define Schedule Container Div
		if (this.blnDebugMode) { console.log("TeamSchedule: Begin Season Schedule Render"); }
		const divSeasonSchedule = document.createElement("div");
		divSeasonSchedule.className = 'bbw-nbawidget-sch-container';

		//*** Initialize tracking variables for current month/year group
		let strGroupMonth = "";
		let strGroupYear = "";

		//*** Check if we have schedule data
		if (!this.arrGameObjects || this.arrGameObjects.length === 0) {
			const divNoData = document.createElement("div");
			divNoData.className = "bbw-nbawidget-nodata";
			divNoData.innerText = "No games found for season";
			divSeasonSchedule.appendChild(divNoData);
			if (this.blnDebugMode) { console.log("TeamSchedule: No standings data available"); }
			return divSeasonSchedule;
		}

		//*** Loop through each game
		for (const objGame of this.arrGameObjects) {
			//*** Get the game's month and year
			const strGameMonth = objGame.dtmGameDate.toLocaleString('en-US', { month: 'long' });
			const strGameYear = objGame.dtmGameDate.getFullYear().toString();

			//*** Check if we've moved to a new month/year group
			if (strGameMonth !== strGroupMonth || strGameYear !== strGroupYear) {
				//*** Update our tracking variables
				strGroupMonth = strGameMonth;
				strGroupYear = strGameYear;

				//*** Render and append the group header
				const strHeaderText = `${strGameMonth} ${strGameYear}`;
				divSeasonSchedule.appendChild(NBAWidget.funcRenderGroupHeader(strHeaderText));
			}

			//*** Render and append the game
			divSeasonSchedule.appendChild(objGame.funcRenderComponent());
		}

		//*** Return Rendered Component
		if (this.blnDebugMode) { console.log("TeamSchedule: Finished Season Schedule Render"); }
		return divSeasonSchedule;
	}

}

/* Game Class
Manages Individual Game Data and Rendering
*/
class Game {
	//********************************************************************
	// Data Methods
	//********************************************************************
	constructor(pdtmGameDate, pstrStatus, pstrSpursTeamName, pstrSpursScore, pblnHasScore, pblnGameOver, pblnWinner, pblnHomeTeam, pstrOppTeamAbbreviation, pstrOppTeamName, pstrOppScore) {
		this.dtmGameDate = pdtmGameDate;
		this.strStatus = pstrStatus;
		this.strSpursTeamName = pstrSpursTeamName;
		this.strSpursScore = pstrSpursScore;
		this.blnHasScore = pblnHasScore;
		this.blnGameOver = pblnGameOver;
		this.blnWinner = pblnWinner;
		this.blnHomeTeam = pblnHomeTeam;
		this.strOppTeamAbbreviation = pstrOppTeamAbbreviation;
		this.strOppTeamName = pstrOppTeamName;
		this.strOppScore = pstrOppScore;

		//*** Default Debug Mode is False
		this.blnDebugMode = false;

		//*** Initialize Detail Catalog
		this.objDetailCatalog = new DetailCatalog();
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
	}

	//********************************************************************
	// Render Methods
	//********************************************************************
	funcRenderComponent(pblnShowYear = false) {
		if (this.blnDebugMode) { console.log("Game: Begin Component Render"); }

		//*** Initialize Tags
		const divGame = document.createElement("div");
		const divContent = document.createElement("div");
		const divTop = document.createElement("div");
		const divDate = document.createElement("div");
		const divStatus = document.createElement("div");
		const divBottom = document.createElement("div");
		const divMatchup = document.createElement("div");
		const imgOurTeam = document.createElement("img");
		const divHomeAwaySymbol = document.createElement("div");
		const imgOpponent = document.createElement("img");
		const divOpponent = document.createElement("div");
		const divTimeScore = document.createElement("div");
		const divGameDetails = document.createElement("div");

		//*** Set Tag Classes
		divGame.className = "bbw-nbawidget-sch-game-row";
		divContent.className = "bbw-nbawidget-sch-game-row-content";
		divTop.className = "bbw-nbawidget-sch-game-row-top";
		divDate.className = "bbw-nbawidget-sch-game-row-date";
		divStatus.className = "bbw-nbawidget-sch-game-row-status";
		divBottom.className = "bbw-nbawidget-sch-game-row-bottom";
		divMatchup.className = "bbw-nbawidget-sch-game-row-matchup";
		imgOurTeam.className = "bbw-nbawidget-sch-team-logo";
		divHomeAwaySymbol.className = "bbw-nbawidget-sch-game-row-homeawaysymbol";
		imgOpponent.className = "bbw-nbawidget-sch-team-logo";
		divOpponent.className = "bbw-nbawidget-sch-game-row-opponent";
		divTimeScore.className = "bbw-nbawidget-sch-game-row-timescore";
		divGameDetails.className = "bbw-nbawidget-sch-game-row-details";

		//*** Set Game Date
		const arrGameDateOptions = { weekday: "short", month: "short", day: "numeric" };
		if (pblnShowYear) { arrGameDateOptions.year = "numeric"; }
		divDate.innerText = this.dtmGameDate.toLocaleDateString("en-US", arrGameDateOptions);

		//*** Set Game Status
		divStatus.innerText = this.strStatus;

		//*** Set Matchup Data
		imgOurTeam.src = NBAWidget.funcGetTeamLogoURL("SA");
		//divHomeAwaySymbol.innerText = this.blnHomeTeam ? "🏠" : "✈️";
		divHomeAwaySymbol.innerText = this.blnHomeTeam ? "vs" : "@";
		divOpponent.innerText = NBAWidget.mapShortenTeamNames[this.strOppTeamName] || this.strOppTeamName;
		imgOpponent.src = NBAWidget.funcGetTeamLogoURL(this.strOppTeamAbbreviation);

		//*** Process Status Information
		let blnShowScore = false;
		let blnShowTime = false;
		let blnFormatWinLoss = false;
		switch (this.strStatus.toLowerCase()) {
			case "scheduled": //*** Show Time as Detail
				blnShowTime = true
				break;

			case "postponed": //*** Show Nothing as Detail
				break;

			case "in progress":
				blnShowScore = true;
				break;

			case "final": //*** Show Score as Detail and Format Final Result Colors
				blnShowScore = true;
				blnFormatWinLoss = true;
				break;

			default: // Ideally doesn'thit, but putting in basic logic
				if (this.blnHasScore) {
					blnShowScore = true;
				}
		}

		//*** Add Time to the Additional Info Tag
		if (blnShowTime) {
			const arrGameTimeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
			divTimeScore.innerText = this.dtmGameDate.toLocaleTimeString("en-US", arrGameTimeOptions);
		}

		//*** Add Score to the Additional Info Tag
		if (blnShowScore) {
			const spanOurScore = document.createElement("span");
			const spanSeparator = document.createElement("span");
			const spanOppScore = document.createElement("span");
			spanSeparator.className = "bbw-nbawidget-sch-game-row-timescore-separator";
			spanOurScore.innerText = (this.strStatus.toLowerCase() === "final" ? (this.blnWinner ? "W " : "L ") : "") + this.strSpursScore;
			//spanOurScore.innerText = this.strSpursScore;
			spanSeparator.innerText = "-";
			spanOppScore.innerText = this.strOppScore;
			divTimeScore.appendChild(spanOurScore);
			divTimeScore.appendChild(spanSeparator);
			divTimeScore.appendChild(spanOppScore);
		}

		//*** Add win/loss formatting tags to relevant divs
		if (blnFormatWinLoss) {
			const strWinLossTag = this.blnWinner ? "win" : "loss";
			divTimeScore.classList.add(strWinLossTag);
			divStatus.classList.add(strWinLossTag);
			divContent.classList.add(strWinLossTag)
		}

		//*** Build Top Section DIV Tag
		divTop.appendChild(divDate);
		divTop.appendChild(divStatus);

		//*** Build Matchup DIV Tag
		//divMatchup.appendChild(imgOurTeam);
		divMatchup.appendChild(divHomeAwaySymbol);
		divMatchup.appendChild(imgOpponent);
		divMatchup.appendChild(divOpponent);

		//*** Build Bottom Section DIV Tag
		divBottom.appendChild(divMatchup);
		divBottom.appendChild(divTimeScore);

		//*** Build Summary Content DIV Tag
		divContent.appendChild(divTop);
		divContent.appendChild(divBottom);

		//*** Create the details section
		divGameDetails.appendChild(this.objDetailCatalog.funcRenderComponent());

		//*** Add click handler for expanding details
		divGame.addEventListener('click', function () {
			const divGameDetailsClicked = divGame.querySelector('.bbw-nbawidget-sch-game-row-details');
			if (divGameDetailsClicked.classList.contains('expanded')) {
				divGameDetailsClicked.classList.remove('expanded');
			} else {
				divGameDetailsClicked.classList.add('expanded');
			}
		});

		//*** Assemble everything
		divGame.appendChild(divContent);
		divGame.appendChild(divGameDetails);

		//*** Return Results
		if (this.blnDebugMode) { console.log("Game: Finished Component Render"); }
		return divGame;
	}

	//********************************************************************
	// Helper Methods & Properties
	//********************************************************************
	//*** Print out Object Values
	funcDebugPrint() {
		return `GameDate: ${this.dtmGameDate}, Status: ${this.strStatus}, SpursTeamName: ${this.strSpursTeamName}, SpursScore: ${this.strSpursScore}, ` +
			`HasScore: ${this.blnHasScore}, GameOver: ${this.blnGameOver}, Winner: ${this.blnWinner}, HomeTeam: ${this.blnHomeTeam}, ` +
			`OppTeamName: ${this.strOppTeamName}, OppScore: ${this.strOppScore}`;
	}
}

/* League Standings Class
Manages the Parsing of Standings Data
*/
class LeagueStandings {
	//********************************************************************
	// Data Methods
	//********************************************************************
	constructor(pobjApiManager, pobjDataManager) {
		//*** Store reference to API manager
		this.objApiManager = pobjApiManager;
		this.objDataManager = pobjDataManager;

		//*** Initialize properties with defaults
		this.strSeason = "";
		this.strSeasonType = "";
		this.strApiSource = "";

		//*** Initialize data storage properties
		this.arrStandingObjects = null;

		//*** Default Debug Mode is False
		this.blnDebugMode = false;
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
	}

	// Load League Standings Data from API - Stores JSON only
	async funcLoadStandingsData(pstrSeason, pstrSeasonType, pstrApiSource, pblnForceRefresh = false) {
		//*** Log request
		if (this.blnDebugMode) {
			console.log(`LeagueStandings - Loading data for Season: ${pstrSeason}, Type: ${pstrSeasonType}, Source: ${pstrApiSource}, ForceRefresh: ${pblnForceRefresh}`);
		}

		//*** Store current request parameters
		this.strSeason = pstrSeason;
		this.strSeasonType = pstrSeasonType;
		this.strApiSource = pstrApiSource;

		//*** If prior seasons, store in local storage.  If current, in session storage (gets cleared per widget load and refreshes)
		let strStorageType = "";
		if (parseInt(pstrSeason) < NBAWidget.stcCurrentSeason) { strStorageType = "local"; } else { strStorageType = "session"; }

		//*** Check if JSON data has been stored in storage
		const strStorageKey = `standings_${pstrSeason}_${pstrSeasonType}`;
		let jsonStandingsData = this.objDataManager.funcGetJSONFromStorage(strStorageType, strStorageKey);
		if (!jsonStandingsData) {
			switch (pstrApiSource.toLowerCase()) {
				case "espn":
					jsonStandingsData = await this.funcGetStandingsDataESPN(pstrSeason, pstrSeasonType);
					break;
				default:
					console.error(`LeagueStandings - Unknown API source: ${pstrApiSource}`);
					return null;
			}
		}

		//*** Handle Results and Data Management
		if (jsonStandingsData) {
			//*** Store Parsed Result in memory
			this.objDataManager.procSaveJSONToStorage(strStorageType, strStorageKey, jsonStandingsData);
			if (this.blnDebugMode) { console.log("LeagueStandings - Data loaded successfully"); }
		} else {
			//*** Ensure Nothing was saved in memory
			this.objDataManager.procRemoveDataFromStorage(strStorageType, strStorageKey);
			if (this.blnDebugMode) { console.log("LeagueStandings - Data load failed"); }
			return;
		}

		//*** Parse JSON File
		this.arrStandingObjects = this.funcParseJSONESPN(jsonStandingsData);
	}

	// Get JSON Data from ESPN
	async funcGetStandingsDataESPN(pstrSeason, pstrSeasonType) {
		//*** level: 1 is league, 2 is conference, 3 is division (0? 4?)
		//*** sort = there are optoins, but sort=playoffseed%3Aasc seems to be the DEFAULT?  it seems to use sort=gamesbehind%3Aasc for preseason
		//*** type = 0 is basic standings, 1 is expanded, 2 is vs division, 3 is in-season tourney
		//*** seasontype = we are alwqys gonna take the regular season values
		const strURLLevel = 2;
		const strURLSort = "playoffseed%3Aasc";
		const strURLType = 0;
		const strURLSeasonType = (pstrSeasonType === "3") ? "2" : pstrSeasonType; //*** Force regular standings if post-season

		//*** Build URL
		const strUrl = `https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings?region=us&lang=en&type=${strURLType}&level=${strURLLevel}&sort=${strURLSort}&season=${pstrSeason}&seasontype=${strURLSeasonType}`;

		//*** Fetch data using API manager
		if (this.blnDebugMode) { console.log(`LeagueStandings - Begin Fetch ESPN Data: ${strUrl}`); }
		const jsonRawJSON = await this.objApiManager.funcGetAPIData(strUrl, "json");

		//*** Return Results
		if (this.blnDebugMode) { console.log(`LeagueStandings - Finish Fetch ESPN Data: ${strUrl}`); }
		return jsonRawJSON;
	}

	// Parse ESPN JSON into Game objects
	funcParseJSONESPN(pobjJSONStandingsData) {
		//*** Log step
		if (this.blnDebugMode) {
			console.log("LeagueStandings - Parsing ESPN JSON data");
		}

		//*** Short circuit if JSON isn't in the proper format
		if (!pobjJSONStandingsData || !pobjJSONStandingsData.children || !pobjJSONStandingsData.children[0] || !pobjJSONStandingsData.children[0].standings) {
			console.error("LeagueStandings - ESPN JSON data is invalid or missing standings info");
			return [];
		}

		//*** Loop through each conference
		const arrStandingsArray = [];
		for (const objConference of pobjJSONStandingsData.children) {
			//*** Get Conference Level data
			const strConferenceName = objConference.name;
			const arrEntries = objConference.standings.entries;

			//*** Skip this conference if there are no entries
			if (!arrEntries || arrEntries.length === 0) {
				if (this.blnDebugMode) {
					console.log(`LeagueStandings - No entries found for ${strConferenceName}`);
				}
				continue;
			}

			//*** Loop through each team in the conference
			let intSeed = 0;
			for (const objEntry of arrEntries) {
				//*** Set Seed #
				intSeed = intSeed + 1;

				//*** Get Entry level data
				const objTeam = objEntry.team;
				const arrStats = objEntry.stats;

				//*** Find wins and losses from the stats array
				const objWins = arrStats.find(objStat => objStat.name === "wins");
				const objLosses = arrStats.find(objStat => objStat.name === "losses");

				//*** Extract the values (or default to 0 if not found)
				const intWins = objWins ? objWins.value : 0;
				const intLosses = objLosses ? objLosses.value : 0;

				//*** Create a Standing object and add it to the array
				if (this.blnDebugMode) {
					console.log(`LeagueStandings - Adding standing Conf: ${strConferenceName} - ${objTeam.shortDisplayName} - ${intWins}-${intLosses}`);
				}
				const objStanding = new Standing(
					strConferenceName,
					objTeam.abbreviation,
					objTeam.displayName,
					objTeam.shortDisplayName,
					intWins,
					intLosses,
					intSeed
				);

				//*** Add additional stats if they're found
				this.procMapESPNStandingStat(arrStats, objStanding.objDetailCatalog)

				//*** Push into array of standings
				objStanding.procSetDebugMode(this.blnDebugMode);
				arrStandingsArray.push(objStanding);
			}
		}

		//*** Filter out any nulls
		const arrFilteredStandings = arrStandingsArray.filter(objStanding => objStanding != null);

		//*** Log completion
		if (this.blnDebugMode) {
			console.log(`LeagueStandings - ESPN parsing complete. ${arrFilteredStandings.length} standings parsed`);
		}

		//*** Return the filtered array
		return arrFilteredStandings;
	}

	//*** Helper function to find and create Detail objects from ESPN stats
	procMapESPNStandingStat(parrStats, pobjDetailCatalog) {
		let objDetailStat = null;

		//*** Get Home Record
		objDetailStat = parrStats.find(s => s.name.toLowerCase() === "home");
		if (objDetailStat) {
			pobjDetailCatalog.procAddDetailByValues(
				"Record Details", "homerecord", "", "", "Home Record", null, objDetailStat.displayValue
			);
		}

		//*** Get Away Record
		objDetailStat = parrStats.find(s => s.name.toLowerCase() === "road");
		if (objDetailStat) {
			pobjDetailCatalog.procAddDetailByValues(
				"Record Details", "awayrecord", "", "", "Away Record", null, objDetailStat.displayValue
			);
		}

		//*** Get Conference Record
		objDetailStat = parrStats.find(s => s.name.toLowerCase() === "vs. conf.");
		if (objDetailStat) {
			pobjDetailCatalog.procAddDetailByValues(
				"Record Details", "confrecord", "", "", "Vs. Conference", null, objDetailStat.displayValue
			);
		}


		//*** Get Division Record
		objDetailStat = parrStats.find(s => s.name.toLowerCase() === "vs. div.");
		if (objDetailStat) {
			pobjDetailCatalog.procAddDetailByValues(
				"Record Details", "divrecord", "", "", "Vs. Division", null, objDetailStat.displayValue
			);
		}

		//*** Get Last 10
		objDetailStat = parrStats.find(s => s.name.toLowerCase() === "last ten games");
		if (objDetailStat) {
			pobjDetailCatalog.procAddDetailByValues(
				"Streak Details", "l10", "", "", "Last 10", null, objDetailStat.displayValue
			);
		}

		//*** Get Streak
		objDetailStat = parrStats.find(s => s.name.toLowerCase() === "streak");
		if (objDetailStat) {
			pobjDetailCatalog.procAddDetailByValues(
				"Streak Details", "streak", "", "", "Streak", null, objDetailStat.displayValue
			);
		}
	}

	// Get Individual Standing Object
	funcGetTeamStanding(pstrTeamCode) {
		//*** Search for the team in the standings array
		return this.arrStandingObjects.find(objStanding => objStanding.strTeamAbbr.toUpperCase() === pstrTeamCode.toUpperCase());
	}

	//********************************************************************
	// Render Methods
	//********************************************************************
	funcRenderComponent() {
		//*** Define Standings Container Div
		if (this.blnDebugMode) { console.log("LeagueStandings: Begin Standings Render"); }
		const divStandings = document.createElement("div");
		divStandings.className = "bbw-nbawidget-std-container";

		//*** Check if we have standings data
		if (!this.arrStandingObjects || this.arrStandingObjects.length === 0) {
			const divNoData = document.createElement("div");
			divNoData.className = "bbw-nbawidget-nodata";
			divNoData.innerText = "No standings found for season";
			divStandings.appendChild(divNoData);
			if (this.blnDebugMode) { console.log("LeagueStandings: No standings data available"); }
			return divStandings;
		}

		//*** Group standings by conference
		const objWesternStandings = [];
		const objEasternStandings = [];
		for (const objStanding of this.arrStandingObjects) {
			if (objStanding.strConference === "Western Conference") {
				objWesternStandings.push(objStanding);
			} else if (objStanding.strConference === "Eastern Conference") {
				objEasternStandings.push(objStanding);
			}
		}

		//*** Render Western Conference first
		if (objWesternStandings.length > 0) {
			const divWestStandings = document.createElement("div");
			divWestStandings.className = "bbw-nbawidget-std-group-conference";
			for (const objStanding of objWesternStandings) {
				divWestStandings.appendChild(objStanding.funcRenderComponent());
			}
			divStandings.appendChild(NBAWidget.funcRenderGroupHeader("Western Conference"));
			divStandings.appendChild(divWestStandings);
		}

		//*** Render Eastern Conference second
		if (objEasternStandings.length > 0) {
			const divEastStandings = document.createElement("div");
			divEastStandings.className = "bbw-nbawidget-std-group-conference";
			for (const objStanding of objEasternStandings) {
				divEastStandings.appendChild(objStanding.funcRenderComponent());
			}
			divStandings.appendChild(NBAWidget.funcRenderGroupHeader("Eastern Conference"));
			divStandings.appendChild(divEastStandings);
		}

		//*** Return Rendered Component
		if (this.blnDebugMode) { console.log("LeagueStandings: Finished Standings Render"); }
		return divStandings;
	}

	//*** Helper Method to Render Conference Group
	funcRenderStandingGroup(arrStandings, pstrGroupTitle = "") {
		//*** Setup Group DIV
		if (this.blnDebugMode) { console.log("LeagueStandings: Begin Standing Group Render"); }
		const divStandingGroup = document.createElement("div");
		divStandingGroup.className = "bbw-nbawidget-std-group";

		//*** Render Header if title passed in
		if (pstrGroupTitle) {
			const divHeader = document.createElement("div");
			divHeader.className = "bbw-nbawidget-std-group-header";
			divHeader.innerText = pstrGroupTitle;
			divStandingGroup.appendChild(divHeader);
		}

		//*** Loop through each standing in the group
		for (const objStanding of arrStandings) {
			divStandingGroup.appendChild(objStanding.funcRenderComponent());
		}

		//*** Return Conference Group
		if (this.blnDebugMode) { console.log("LeagueStandings: Finished Standing Group Render"); }
		return divStandingGroup;
	}
}

/* Standing Class
Manages Individual Standing Data and Rendering
*/
class Standing {
	//********************************************************************
	// Data Methods
	//********************************************************************
	constructor(strConference, strTeamAbbr, strTeamDisplayName, strTeamShortDisplayName, intWins, intLosses, intSeed) {
		//*** Set Standard Variable
		this.strConference = strConference;
		this.strTeamAbbr = strTeamAbbr;
		this.strTeamDisplayName = strTeamDisplayName;
		this.strTeamShortDisplayName = strTeamShortDisplayName;
		this.intWins = intWins;
		this.intLosses = intLosses;
		this.intSeed = intSeed;

		//*** Initialize Detail Catalog
		this.objDetailCatalog = new DetailCatalog();

		//*** Default Debug Mode is False
		this.blnDebugMode = false;
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
	}

	//********************************************************************
	// Render Methods
	//********************************************************************
	funcRenderComponent() {
		//*** Define Standing div container
		if (this.blnDebugMode) { console.log("Standing: Begin Component Render"); }

		// Initialize div tags
		const divStanding = document.createElement("div");
		const divStandingSummary = document.createElement("div");
		const divSeed = document.createElement("div");
		const imgLogo = document.createElement("img");
		const divTeamName = document.createElement("div");
		const divWins = document.createElement("div");
		const divLosses = document.createElement("div");
		const divStandingDetails = document.createElement("div");

		//** Set class names
		divStanding.className = "bbw-nbawidget-std-standing-row";
		divStandingSummary.className = "bbw-nbawidget-std-standing-row-summary";
		divSeed.className = "bbw-nbawidget-std-standing-row-summary-seed";
		imgLogo.className = "bbw-nbawidget-std-standing-row-summary-logo";
		divTeamName.className = "bbw-nbawidget-std-standing-row-summary-teamname";
		divWins.className = "bbw-nbawidget-std-standing-row-summary-wins";
		divLosses.className = "bbw-nbawidget-std-standing-row-summary-losses";
		divStandingDetails.className = "bbw-nbawidget-std-standing-row-details";

		//*** Set seed number element	
		divSeed.innerText = this.intSeed;
		if (this.intSeed >= 1 && this.intSeed <= 6) {
			divSeed.style.borderRight = "2px solid var(--bbw-palette-status-win-text)";
		} else if (this.intSeed >= 7 && this.intSeed <= 10) {
			divSeed.style.borderRight = "2px solid var(--bbw-palette-status-playin-text)";
		}

		//*** Set team logo element
		imgLogo.src = NBAWidget.funcGetTeamLogoURL(this.strTeamAbbr);

		//*** Set team name element
		divTeamName.innerText = NBAWidget.mapShortenTeamNames[this.strTeamShortDisplayName] || this.strTeamShortDisplayName;

		//*** Set wins element
		divWins.innerText = this.intWins;

		//*** Set losses element
		divLosses.innerText = this.intLosses;

		//*** Build the standing summary row
		divStandingSummary.appendChild(divSeed);
		divStandingSummary.appendChild(imgLogo);
		divStandingSummary.appendChild(divTeamName);
		divStandingSummary.appendChild(divWins);
		divStandingSummary.appendChild(divLosses);

		//*** Add click handler for expanding details
		divStanding.addEventListener('click', function () {
			const divStandingDetailsClicked = divStanding.querySelector('.bbw-nbawidget-std-standing-row-details');
			if (divStandingDetailsClicked.classList.contains('expanded')) {
				divStandingDetailsClicked.classList.remove('expanded');
			} else {
				divStandingDetailsClicked.classList.add('expanded');
			}
		});

		//*** Create the details section
		divStandingDetails.appendChild(this.objDetailCatalog.funcRenderComponent())

		//*** Return Rendered Component
		divStanding.appendChild(divStandingSummary);
		divStanding.appendChild(divStandingDetails);
		if (this.blnDebugMode) { console.log("Standing: Finished Component Render"); }
		return divStanding;
	}
}

/* Detail Catalog Class
Generic Handling of Stats/Details
*/
class DetailCatalog {
	//********************************************************************
	// Data Methods
	//********************************************************************
	constructor() {
		//*** Initialize the catalog as an empty object (key-value pairs)
		this.objDetailCatalog = {};

		//*** Default Debug Mode is False
		this.blnDebugMode = false;
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
	}

	//*** Add a detail to a specific catalog
	procAddDetail(pstrCatalogName, pobjDetail) {
		if (this.blnDebugMode) {
			console.log(`DetailCatalog: Adding detail ${pobjDetail.strID} to catalog ${pstrCatalogName}`);
		}

		//*** Initialize the catalog array if it doesn't exist
		if (!this.objDetailCatalog[pstrCatalogName]) {
			this.objDetailCatalog[pstrCatalogName] = [];
		}

		//*** Set debug mode for the new detail to match catalog
		pobjDetail.procSetDebugMode(this.blnDebugMode);

		//*** Add the detail to the catalog
		this.objDetailCatalog[pstrCatalogName].push(pobjDetail);
	}

	//*** Add a detail to a specific catalog by creating the Detail object
	procAddDetailByValues(pstrCatalogName, pstrID, pstrType, pstrShortDisplayName, pstrFullDisplayName, pobjValue, pstrDisplayValue) {
		if (this.blnDebugMode) { console.log(`DetailCatalog: Adding detail ${pstrID} to catalog ${pstrCatalogName} by values`); }

		//*** Create the Detail object
		const objNewDetail = new Detail(pstrID, pstrType, pstrShortDisplayName, pstrFullDisplayName, pobjValue, pstrDisplayValue);
		this.procAddDetail(pstrCatalogName, objNewDetail);
	}

	//*** Remove a detail from a specific catalog by ID
	procRemoveDetail(pstrCatalogName, pstrDetailID) {
		if (this.blnDebugMode) {
			console.log(`DetailCatalog: Removing detail ${pstrDetailID} from catalog ${pstrCatalogName}`);
		}

		//*** Check if catalog exists
		if (!this.objDetailCatalog[pstrCatalogName]) {
			if (this.blnDebugMode) {
				console.log(`DetailCatalog: Catalog ${pstrCatalogName} does not exist`);
			}
			return false;
		}

		//*** Find and remove the detail
		const intOriginalLength = this.objDetailCatalog[pstrCatalogName].length;
		this.objDetailCatalog[pstrCatalogName] = this.objDetailCatalog[pstrCatalogName].filter(
			objDetail => objDetail.strID !== pstrDetailID
		);
	}

	//********************************************************************
	// Render Methods
	//********************************************************************
	funcRenderComponent() {
		if (this.blnDebugMode) { console.log("DetailCatalog: Begin Component Render"); }

		//*** Create main catalog container
		const divCatalogContainer = document.createElement("div");
		divCatalogContainer.className = "bbw-nbawidget-detail-catalog";

		//*** Check if there are any catalogs to render
		const arrCatalogNames = Object.keys(this.objDetailCatalog);
		if (arrCatalogNames.length === 0) {
			const divNoData = document.createElement("div");
			divNoData.className = "bbw-nbawidget-detail-catalog-nodata";
			divNoData.innerText = "No details available";
			divCatalogContainer.appendChild(divNoData);
			return divCatalogContainer;
		}

		//*** Loop through each catalog
		for (const strCatalogName of arrCatalogNames) {
			//*** Get Catalog Records
			const arrCatalogDetails = this.objDetailCatalog[strCatalogName];

			//*** Create and add catalog header
			const divCatalogHeader = document.createElement("div");
			divCatalogHeader.className = "bbw-nbawidget-detail-catalog-header";
			divCatalogHeader.innerText = strCatalogName;
			divCatalogContainer.appendChild(divCatalogHeader);

			//*** Loop through each detail in this catalog
			for (const objDetail of arrCatalogDetails) {
				divCatalogContainer.appendChild(objDetail.funcRenderComponent());
			}
		}

		if (this.blnDebugMode) { console.log("DetailCatalog: Finished Component Render"); }
		return divCatalogContainer;
	}
}

/* Detail  Class
Individual Detail Item
*/
class Detail {
	//********************************************************************
	// Data Methods
	//********************************************************************
	constructor(pstrID, pstrType, pstrShortDisplayName, pstrFullDisplayName, pobjValue, pstrDisplayValue) {
		this.strID = pstrID;
		this.strType = pstrType;
		this.strShortDisplayName = pstrShortDisplayName;
		this.strFullDisplayName = pstrFullDisplayName;
		this.objValue = pobjValue;
		this.strDisplayValue = pstrDisplayValue;

		//*** Default Debug Mode is False
		this.blnDebugMode = false;
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
	}

	//********************************************************************
	// Render Methods
	//********************************************************************
	funcRenderComponent() {
		if (this.blnDebugMode) { console.log(`Detail: Begin Component Render for ${this.strID}`); }

		//*** Initialize DIV tags
		const divDetailRow = document.createElement("div");
		const divDetailName = document.createElement("div");
		const divDetailSeparator = document.createElement("div");
		const divDetailValue = document.createElement("div");

		//*** Set Classes
		divDetailRow.className = "bbw-nbawidget-detail-row";
		divDetailName.className = "bbw-nbawidget-detail-name";
		divDetailSeparator.className = "bbw-nbawidget-detail-separator";
		divDetailValue.className = "bbw-nbawidget-detail-value";

		//*** Set name element
		divDetailName.innerText = this.strFullDisplayName;

		//*** Set separator element
		divDetailSeparator.innerText = ":";

		//*** Set value element
		switch (this.strType) {
			case "link":
				//*** Create hyperlink for link type
				const linkElement = document.createElement("a");
				linkElement.href = this.objValue;
				linkElement.innerText = this.strDisplayValue;
				linkElement.target = "_blank";
				linkElement.rel = "noopener noreferrer";
				linkElement.addEventListener('click', function (event) {
					event.stopPropagation();
				});
				divDetailValue.appendChild(linkElement);
				break;

			case "text":
			case "date":
			case "datetime":
			case "quantity":
			case "decimal":
			case "currency":
			case "percent":
			case "variant":
			default:
				//*** Regular text for all other types
				divDetailValue.innerText = this.strDisplayValue;
				break;
		}

		//*** Build the detail row
		divDetailRow.appendChild(divDetailName);
		divDetailRow.appendChild(divDetailSeparator);
		divDetailRow.appendChild(divDetailValue);

		if (this.blnDebugMode) { console.log(`Detail: Finished Component Render for ${this.strID}`); }
		return divDetailRow;
	}
}

/* API Manager Class
Seggregating API Calls away from Widget class for future modularity
*/
class APIManager {
	// Constructor
	constructor() {
		//*** Default Debug Mode is False
		this.blnDebugMode = false;
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
	}

	// Get Data from Any REST API with Caching
	async funcGetAPIData(pstrApiUrl, pstrMethod) {
		//*** Wrapper method to allow other types of fetches that then build JSON (ie: screen scrapper)
		switch (pstrMethod.toLowerCase()) {
			case "json":
				return await this.funcFetchJSONDataFromURL(pstrApiUrl);
			default:
				console.error("API Method not supported: ", pstrMethod)
				return null;
		}
	}

	// Fetch Data from Any JSON based REST API
	async funcFetchJSONDataFromURL(pstrApiUrl) {
		//*** Log URL being fetched
		if (this.blnDebugMode) { console.log("API Manager - Fetching JSON from URL: " + pstrApiUrl); }

		//*** Attempt to fetch from API
		try {
			//*** Make the HTTP request
			const objResponse = await fetch(pstrApiUrl);

			//*** Check if response was successful
			if (!objResponse.ok) {
				console.error(`API Manager- HTTP Error: ${objResponse.status} ${objResponse.statusText}`);
				return null;
			}

			//*** Parse JSON response
			const jsonData = await objResponse.json();

			//*** Log successful response
			if (this.blnDebugMode) {
				console.log("API Manager - Fetch successful. Top-level keys:", Object.keys(jsonData));
			}

			//*** Return the parsed JSON
			return jsonData;

		} catch (error) {
			//*** Log the error and return null for soft failure
			console.error("API Manager - Fetch error:", error.message);
			return null;
		}
	}

}

/* Storage Manager Class
Seggregating Storage Management away from Widget class for future modularity
*/
class StorageManager {
	// Constructor
	constructor(pstrStorageNamespace) {
		//*** Validate Namespace is Provided
		if (!pstrStorageNamespace || pstrStorageNamespace.trim() === "") {
			throw new Error("Data Manager - Storage namespace is required");
		}

		//*** Store Namespace
		this.strStorageNamespace = pstrStorageNamespace;

		//*** Default Debug Mode is False
		this.blnDebugMode = false;
	}

	//*** Set Debug Method - Controls Logging
	procSetDebugMode(pblnDebugMode) {
		this.blnDebugMode = pblnDebugMode;
	}

	//*** Build Namespaced Storage Key
	funcBuildNamespacedKey(pstrStorageKey) {
		return `${this.strStorageNamespace}::${pstrStorageKey}`;
	}

	//*** Get Generic Data From Storage
	funcGetDataFromStorage(pstrStorageType, pstrStorageKey) {
		//*** Build Namespaced Key
		const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

		//*** Log Debug
		if (this.blnDebugMode) { console.log(`Data Manager - Retrieve ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

		//*** Attempt to Retrieve Storage
		let strStorageData = "";
		switch (pstrStorageType.toLowerCase()) {
			case "local":
				strStorageData = localStorage.getItem(strNamespacedKey);
				break;
			case "session":
				strStorageData = sessionStorage.getItem(strNamespacedKey);
				break;
			default:
				console.error("Data Manager - Storage Retrieval Type not supported: ", pstrStorageType)
		}

		//*** Return Data Found
		if (strStorageData) { if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage hit for key: ${strNamespacedKey}`); } }
		return strStorageData;
	}

	//*** Save Generic Data To Storage
	procSaveDataToStorage(pstrStorageType, pstrStorageKey, pstrData) {
		//*** Build Namespaced Key
		const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

		//*** Log Debug
		if (this.blnDebugMode) { console.log(`Data Manager - Save ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

		//*** Attempt to Save to Storage
		switch (pstrStorageType.toLowerCase()) {
			case "local":
				localStorage.setItem(strNamespacedKey, pstrData);
				break;
			case "session":
				sessionStorage.setItem(strNamespacedKey, pstrData);
				break;
			default:
				console.error("Data Manager - Storage Type not supported: ", pstrStorageType)
		}

		//*** Log Storage Saved
		if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage saved for key: ${strNamespacedKey}`); }
	}

	//*** Remove Single Item From Storage
	procRemoveDataFromStorage(pstrStorageType, pstrStorageKey) {
		//*** Build Namespaced Key
		const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

		//*** Log Debug
		if (this.blnDebugMode) { console.log(`Data Manager - Remove ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

		//*** Attempt to Remove from Storage
		switch (pstrStorageType.toLowerCase()) {
			case "local":
				localStorage.removeItem(strNamespacedKey);
				break;
			case "session":
				sessionStorage.removeItem(strNamespacedKey);
				break;
			default:
				console.error("Data Manager - Storage Type not supported: ", pstrStorageType)
		}
		//*** Log successful removal
		if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage removed for key: ${strNamespacedKey}`); }
	}

	//*** Clear All Session Storage for This Namespace
	procClearSessionStorage() {
		//*** Log Debug
		if (this.blnDebugMode) { console.log(`Data Manager - Clearing Session Storage for namespace: ${this.strStorageNamespace}`); }

		//*** Build Namespace Prefix
		const strNamespacePrefix = `${this.strStorageNamespace}::`;

		//*** Loop Through Session Storage and Remove Matching Keys
		let intKeysRemoved = 0;
		for (let i = sessionStorage.length - 1; i >= 0; i--) {
			const strKey = sessionStorage.key(i);
			if (strKey && strKey.startsWith(strNamespacePrefix)) {
				sessionStorage.removeItem(strKey);
				intKeysRemoved++;
			}
		}

		//*** Log successful clear
		if (this.blnDebugMode) { console.log(`Data Manager - Session Storage cleared. Keys removed: ${intKeysRemoved}`); }
	}

	//*** Clear All Local Storage for This Namespace
	procClearLocalStorage() {
		//*** Log Debug
		if (this.blnDebugMode) { console.log(`Data Manager - Clearing Local Storage for namespace: ${this.strStorageNamespace}`); }

		//*** Build Namespace Prefix
		const strNamespacePrefix = `${this.strStorageNamespace}::`;

		//*** Loop Through Local Storage and Remove Matching Keys
		let intKeysRemoved = 0;
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const strKey = localStorage.key(i);
			if (strKey && strKey.startsWith(strNamespacePrefix)) {
				localStorage.removeItem(strKey);
				intKeysRemoved++;
			}
		}

		//*** Log successful clear
		if (this.blnDebugMode) { console.log(`Data Manager - Local Storage cleared. Keys removed: ${intKeysRemoved}`); }
	}

	// Save Data to Session Storage Cache
	procSaveJSONToStorage(pstrStorageType, pstrStorageKey, pjsonData) {
		try {
			//*** Convert JSON to string for storage
			const strJsonData = JSON.stringify(pjsonData);
			this.procSaveDataToStorage(pstrStorageType, pstrStorageKey, strJsonData);

			//*** Log cache save
			if (this.blnDebugMode) { console.log(`Data Manager - JSON Cached with key: ${pstrStorageKey}`); }

		} catch (error) {
			//*** Log cache save error but don't fail the operation
			console.error("Data Manager - Storage save error:", error.message);
		}
	}

	// Get Data from Session Storage Cache
	funcGetJSONFromStorage(pstrStorageType, pstrStorageKey) {
		try {
			//*** Retrieve JSON Data
			const strStoredData = this.funcGetDataFromStorage(pstrStorageType, pstrStorageKey);

			//*** Return null if no cached data found
			if (!strStoredData) { return null; }

			//*** Parse the JSON string back to object
			const jsonStoredData = JSON.parse(strStoredData);

			//*** Log cache hit
			if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage hit for key: ${pstrStorageKey}`); }

			//*** Return the parsed data
			return jsonStoredData;

		} catch (error) {
			//*** Log cache retrieval error and return null
			console.error(`Data Manager - Error retrieving ${pstrStorageType} Storage hit for key: ${pstrStorageKey}: `, error.message);
			return null;
		}
	}
}

/* Run Widget 
Main Hook to Replace Placeholder DIV tag
*/
(function () {
	//*** Wrap Initialize function 
	'use strict';
	function initNBAWidget() {
		//*** Get container and read data attributes
		const divWidgetContainer = document.getElementById("bbw-nbawidget-container");

		//*** Check if container exists
		if (!divWidgetContainer) {
			console.error("NBA Widget: Container element 'bbw-nbawidget-container' not found");
			return;
		}

		const strTeamCode = divWidgetContainer.dataset.teamCode || "sa";
		const strStorageNamespace = divWidgetContainer.dataset.storageNamespace || "bbw-nbawidget";
		const blnDebugMode = divWidgetContainer.dataset.debugMode === "false";

		//*** Initialize widget with parameters from HTML
		const objNBAWidget = new NBAWidget(strTeamCode, "bbw-nbawidget-container", strStorageNamespace, blnDebugMode);
		(async () => {
			objNBAWidget.procClearWidgetSessionStorage();
			if (objNBAWidget.objPreferences.autoLoadWidget) {
				await objNBAWidget.procLoadData();
			}
			objNBAWidget.procRenderWidgetContainer();
		})();
	}

	//*** Only run when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initNBAWidget);
	} else {
		initNBAWidget();
	}
})();

//********************************************************************
// Issues & New Features
//  - Tab changes re-render the whole widget... wonder if we can
//	  just re-render the content
//	- The fetch API data wrapper should check for param validity
//	- The proc to parse games is returning values, shoudl be func
//	  or should check methods using it to see if return value is
//	  expected or not
//	- Enable post-season functionality
//	- Rename game content to Summary
//	- Standings seeding still using inline CSS
//  - Realistically I should just take copies of previous season
//	  schedules & standings and store them somewhere in our site
//	  so we don't hit ESPN... but not sure
//	- Standard class to spit back a no data block?
//	- Need to work on link styling, but for now BB takes care of it
//	- There are still some hardcoded spurs things in here, like the
//	  score retrieval
//********************************************************************