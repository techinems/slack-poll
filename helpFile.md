*Help: `/inorout`*

Hi there! `/inorout` gives you the ability to quickly poll the current channel.

*Usage*

```
/inorout [multiple] [anon] [help]
Question
Answer 1
[Answer 2]
...
[Answer n]
```

*Simple polls*

A simple poll can be created with:

```
/inorout
Do you like DPS?
Yes
No
Only 540
```

Each answer must be written on its own line. Questions and answers can even use emojis,
if you like! :wink:

*Multiple selections*

You can configure `/inorout` to allow responders to select more than one option! This
needs the `/inorout multiple` flag.

Suppose we want to know what day of the weekend people are free to see a movie. Someone
might be free both Friday and Saturday. Rather than create combinations of all 3 options
we instead can allow for people to select multiple choices using the `multiple` option.
That would look like
```
/inorout multiple
When should we go to Snowman's?
1800
1830
1900
```
Take note of how we put any options on the same line as the command followed by the
question on the next line.

*Anonymous polls*

You can also configure `/inorout` to allow responders to select more than one option!
This needs the `/inorout anon` flag.

There are some cases where we may want to allow for someone to vote without revealing
their identity. That can be accomplished with the `anon` option and looks like
```
/inorout anon
The best LT was
923
982
992
```
Again, like with `multiple`, we put the option `anon` on the same line as the command.

*Combining options*
If you want to use multiple options, just put them on the same line separated by a space
(i.e. `/inorout multiple anon`). This would create an anonymous poll where multiple
answers are allowed. Order doesn't matter. The current list of options are
```
multiple, anon, help
```
If you have a request for a new option, reach out in #dev!

*Changing published polls*

Once you publish a poll, the author has the following options: 
* *:lock: lock poll* - prevents any changes to votes.
* *move to bottom* - removes the poll from its current location and sends it to the
bottom of the channel
* *delete poll* - removes the question, answer choices, and responses, leaving a message
saying that a deleted poll was once there.

Additionally, users can choose to *remove their vote* until the poll has been locked or
deleted.
